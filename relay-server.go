package main

import (
	"encoding/json"
	"log"
	"net/http"
	"os"
	"strings"
	"sync"
	"time"

	"github.com/gorilla/mux"
	"github.com/gorilla/websocket"
)

// Build information - set at compile time or via environment
var (
	BuildCommit   = os.Getenv("BUILD_COMMIT")
	BuildTime     = os.Getenv("BUILD_TIME")
	BuildActor    = os.Getenv("BUILD_ACTOR")
	BuildRunID    = os.Getenv("BUILD_RUN_ID")
	BuildRunURL   = os.Getenv("BUILD_RUN_URL")
	ServerVersion = "1.0.0"
)

type Client struct {
	conn     *websocket.Conn
	send     chan []byte
	username string
	hub      *Hub
}

type Hub struct {
	clients    map[string]*Client
	broadcast  chan Message
	register   chan *Client
	unregister chan *Client
	mu         sync.RWMutex
	startTime  time.Time
	stats      ServerStats
}

type Message struct {
	From string `json:"from"`
	Data []byte `json:"data"`
}

type ServerStats struct {
	TotalConnections   uint64
	TotalMessages      uint64
	TotalBytesRelayed  uint64
}

var upgrader = websocket.Upgrader{
	CheckOrigin: func(r *http.Request) bool {
		return true // Allow all origins for simplicity
	},
	ReadBufferSize:  1024 * 1024, // 1MB
	WriteBufferSize: 1024 * 1024, // 1MB
}

func NewHub() *Hub {
	return &Hub{
		clients:    make(map[string]*Client),
		broadcast:  make(chan Message, 256),
		register:   make(chan *Client),
		unregister: make(chan *Client),
		startTime:  time.Now(),
	}
}

func (h *Hub) Run() {
	for {
		select {
		case client := <-h.register:
			h.mu.Lock()
			h.clients[client.username] = client
			h.stats.TotalConnections++
			h.mu.Unlock()
			log.Printf("User '%s' connected. Total users: %d", client.username, len(h.clients))

		case client := <-h.unregister:
			h.mu.Lock()
			if _, ok := h.clients[client.username]; ok {
				delete(h.clients, client.username)
				close(client.send)
			}
			h.mu.Unlock()
			log.Printf("User '%s' disconnected. Total users: %d", client.username, len(h.clients))

		case message := <-h.broadcast:
			h.mu.Lock()
			h.stats.TotalMessages++
			h.stats.TotalBytesRelayed += uint64(len(message.Data))
			h.mu.Unlock()
			
			h.mu.RLock()
			// Send to all clients except the sender
			for username, client := range h.clients {
				if username != message.From {
					select {
					case client.send <- message.Data:
					default:
						close(client.send)
						delete(h.clients, username)
					}
				}
			}
			h.mu.RUnlock()
		}
	}
}

func (c *Client) ReadPump() {
	defer func() {
		c.hub.unregister <- c
		c.conn.Close()
	}()

	c.conn.SetReadLimit(10 * 1024 * 1024) // 10MB max message
	c.conn.SetReadDeadline(time.Now().Add(60 * time.Second))
	c.conn.SetPongHandler(func(string) error {
		c.conn.SetReadDeadline(time.Now().Add(60 * time.Second))
		return nil
	})

	for {
		_, data, err := c.conn.ReadMessage()
		if err != nil {
			if websocket.IsUnexpectedCloseError(err, websocket.CloseGoingAway, websocket.CloseAbnormalClosure) {
				log.Printf("WebSocket error: %v", err)
			}
			break
		}

		// Broadcast the raw message to all other clients
		c.hub.broadcast <- Message{
			From: c.username,
			Data: data,
		}
	}
}

func (c *Client) WritePump() {
	ticker := time.NewTicker(54 * time.Second)
	defer func() {
		ticker.Stop()
		c.conn.Close()
	}()

	for {
		select {
		case message, ok := <-c.send:
			c.conn.SetWriteDeadline(time.Now().Add(10 * time.Second))
			if !ok {
				c.conn.WriteMessage(websocket.CloseMessage, []byte{})
				return
			}
			c.conn.WriteMessage(websocket.BinaryMessage, message)

		case <-ticker.C:
			c.conn.SetWriteDeadline(time.Now().Add(10 * time.Second))
			if err := c.conn.WriteMessage(websocket.PingMessage, nil); err != nil {
				return
			}
		}
	}
}

func HandleWebSocket(hub *Hub) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		// Extract username from URL path
		vars := mux.Vars(r)
		username := vars["username"]
		
		if username == "" {
			http.Error(w, "Username required in URL", http.StatusBadRequest)
			return
		}

		// Check if username already exists
		hub.mu.RLock()
		if _, exists := hub.clients[username]; exists {
			hub.mu.RUnlock()
			http.Error(w, "Username already connected", http.StatusConflict)
			return
		}
		hub.mu.RUnlock()

		// Upgrade to WebSocket
		conn, err := upgrader.Upgrade(w, r, nil)
		if err != nil {
			log.Printf("WebSocket upgrade failed: %v", err)
			return
		}

		client := &Client{
			conn:     conn,
			send:     make(chan []byte, 256),
			username: username,
			hub:      hub,
		}

		hub.register <- client

		go client.WritePump()
		go client.ReadPump()
	}
}

func HandleHealth(hub *Hub) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		hub.mu.RLock()
		users := make([]string, 0, len(hub.clients))
		for username := range hub.clients {
			users = append(users, username)
		}
		clientCount := len(hub.clients)
		stats := hub.stats
		uptime := time.Since(hub.startTime)
		hub.mu.RUnlock()

		// Prepare deployment info
		deploymentInfo := map[string]interface{}{
			"commit":    getEnvOrDefault("BUILD_COMMIT", "unknown"),
			"timestamp": getEnvOrDefault("BUILD_TIME", time.Now().UTC().Format(time.RFC3339)),
			"actor":     getEnvOrDefault("BUILD_ACTOR", "manual"),
			"run_id":    getEnvOrDefault("BUILD_RUN_ID", ""),
			"run_url":   getEnvOrDefault("BUILD_RUN_URL", ""),
		}

		health := map[string]interface{}{
			"status":  "healthy",
			"version": ServerVersion,
			"deployment": deploymentInfo,
			"server": map[string]interface{}{
				"uptime_seconds":      uptime.Seconds(),
				"start_time":         hub.startTime.UTC().Format(time.RFC3339),
				"current_time":       time.Now().UTC().Format(time.RFC3339),
			},
			"metrics": map[string]interface{}{
				"connected_users":      clientCount,
				"users":               users,
				"total_connections":   stats.TotalConnections,
				"total_messages":      stats.TotalMessages,
				"total_bytes_relayed": stats.TotalBytesRelayed,
				"messages_per_second": float64(stats.TotalMessages) / uptime.Seconds(),
				"bandwidth_mbps":      float64(stats.TotalBytesRelayed*8) / (uptime.Seconds() * 1000000),
			},
		}

		w.Header().Set("Content-Type", "application/json")
		w.Header().Set("Access-Control-Allow-Origin", "*")
		json.NewEncoder(w).Encode(health)
	}
}

func getEnvOrDefault(key, defaultValue string) string {
	if value := os.Getenv(key); value != "" {
		return value
	}
	return defaultValue
}

func main() {
	// Log deployment information on startup
	log.Printf("🚀 WebSocket Relay Server v%s starting", ServerVersion)
	log.Printf("📦 Deployment: Commit=%s, Actor=%s, Time=%s", 
		getEnvOrDefault("BUILD_COMMIT", "unknown"),
		getEnvOrDefault("BUILD_ACTOR", "manual"),
		getEnvOrDefault("BUILD_TIME", time.Now().UTC().Format(time.RFC3339)))
	
	hub := NewHub()
	go hub.Run()

	router := mux.NewRouter()
	
	// WebSocket endpoint with username in URL
	router.HandleFunc("/ws/{username}", HandleWebSocket(hub))
	
	// Health check endpoint
	router.HandleFunc("/health", HandleHealth(hub))
	
	// CORS middleware
	router.Use(func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			w.Header().Set("Access-Control-Allow-Origin", "*")
			w.Header().Set("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
			w.Header().Set("Access-Control-Allow-Headers", "Content-Type")
			
			if r.Method == "OPTIONS" {
				w.WriteHeader(http.StatusOK)
				return
			}
			
			next.ServeHTTP(w, r)
		})
	})

	port := ":8080"
	log.Printf("📡 Server listening on %s", port)
	log.Printf("🔗 Connect via: ws://localhost%s/ws/{username}", port)
	log.Fatal(http.ListenAndServe(port, router))
}