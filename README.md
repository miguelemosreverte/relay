# WebSocket Relay Server

A high-performance, content-agnostic WebSocket relay server that broadcasts messages between connected clients. Perfect for building real-time applications like chat rooms, video conferencing, collaborative tools, and more.

📊 **[View Live Performance Dashboard →](https://miguelemosreverte.github.io/relay/)**

## Features

- 🚀 **High Performance**: Handles thousands of messages per second
- 🔐 **Automatic SSL**: Built-in Let's Encrypt support via Caddy
- 📡 **Content Agnostic**: Relay any data type (text, binary, JSON)
- 🏷️ **URL-based Identity**: Users identified by username in URL path
- 🐳 **Docker Ready**: Easy deployment with Docker Compose
- 📊 **Benchmarking Suite**: Built-in performance testing tools
- 🔄 **Zero Configuration**: Works out of the box

## Quick Start

### Using Docker Compose (Recommended)

```bash
docker-compose up -d
```

This starts:
- WebSocket relay server on port 8080
- Caddy proxy with automatic SSL on ports 80/443

### Manual Installation

```bash
# Install dependencies
go mod init websocket-relay
go get github.com/gorilla/websocket
go get github.com/gorilla/mux

# Build
go build -o relay-server relay-server.go

# Run
./relay-server
```

## Usage

### Connecting to the Server

Connect via WebSocket with your username in the URL:
```
wss://your-domain.com/ws/{username}
```

### JavaScript Client Example

```javascript
// Connect
const ws = new WebSocket('wss://your-domain.com/ws/alice');

// Send message (broadcasts to all other users)
ws.send(JSON.stringify({
    type: 'chat',
    message: 'Hello everyone!'
}));

// Receive messages from others
ws.onmessage = (event) => {
    const data = JSON.parse(event.data);
    console.log('Received:', data);
};
```

### Audio Streaming Example

See `audio-client.html` for a complete example of streaming audio between clients.

## API Endpoints

### WebSocket Connection
- **URL**: `/ws/{username}`
- **Protocol**: WebSocket
- **Description**: Establishes bidirectional connection for message relay

### Health Check
- **URL**: `/health`
- **Method**: GET
- **Response**: JSON with server status and connected users
```json
{
    "status": "healthy",
    "users": ["alice", "bob"],
    "count": 2
}
```

## Performance

Based on benchmark tests with 10 concurrent clients:

| Metric | Value |
|--------|-------|
| Throughput | 7,420 msg/sec |
| Bandwidth | 60 Mbps |
| Avg Latency | 69 ms |
| P99 Latency | 310 ms |
| Connection Time | 75 ms |

Run benchmarks yourself:
```bash
npm install
node benchmark.js
```

## Deployment

### Deploy to Hetzner (or any VPS)

1. **Set up server**:
```bash
ssh root@your-server-ip
git clone https://github.com/yourusername/websocket-relay-server
cd websocket-relay-server
```

2. **Configure Caddy** (edit `Caddyfile.docker`):
```
your-domain.com {
    @websocket {
        header Connection *Upgrade*
        header Upgrade websocket
    }
    
    handle @websocket {
        reverse_proxy relay:8080
    }
}
```

3. **Start services**:
```bash
docker-compose up -d
```

### Using GitHub Actions

The repository includes GitHub Actions workflow for automatic deployment:

1. Add secrets to your repository:
   - `HETZNER_HOST`: Your server IP
   - `HETZNER_SSH_KEY`: Private SSH key
   - `HETZNER_USERNAME`: SSH username (usually `root`)

2. Push to main branch to trigger deployment

## Architecture

```
┌─────────────┐     WSS      ┌─────────────┐     HTTP/2    ┌─────────────┐
│   Client A  │◄────────────►│    Caddy    │◄────────────►│    Relay    │
└─────────────┘              │   (Proxy)   │              │   Server    │
                             └─────────────┘              └─────────────┘
┌─────────────┐                    ▲                            ▲
│   Client B  │────────────────────┘                            │
└─────────────┘                                                 │
                                                                │
┌─────────────┐                                                 │
│   Client C  │─────────────────────────────────────────────────┘
└─────────────┘
```

## Configuration

### Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | 8080 | WebSocket server port |
| `MAX_MESSAGE_SIZE` | 10MB | Maximum message size |
| `READ_BUFFER_SIZE` | 1MB | WebSocket read buffer |
| `WRITE_BUFFER_SIZE` | 1MB | WebSocket write buffer |

### Docker Compose Configuration

Edit `docker-compose.yml` to customize:
- Port mappings
- Volume mounts
- Network settings
- Resource limits

## Development

### Project Structure
```
.
├── relay-server.go       # Main server implementation
├── benchmark.js          # Performance testing suite
├── audio-client.html     # Example audio streaming client
├── Dockerfile.relay      # Docker build configuration
├── docker-compose.yml    # Multi-container setup
├── Caddyfile.docker     # Caddy proxy configuration
├── .github/
│   └── workflows/
│       └── deploy.yml   # GitHub Actions deployment
└── README.md
```

### Running Tests

```bash
# Benchmark test
node benchmark.js

# Load test with custom parameters
node benchmark.js --clients 50 --duration 10000
```

### Building from Source

```bash
# Linux/Mac
go build -o relay-server relay-server.go

# Windows
go build -o relay-server.exe relay-server.go

# Cross-compile for ARM64 (e.g., Hetzner ARM servers)
GOOS=linux GOARCH=arm64 go build -o relay-server-arm64 relay-server.go
```

## Security Considerations

- **Authentication**: Currently uses simple username-based identification. Add JWT tokens for production.
- **Rate Limiting**: Implement rate limiting to prevent abuse.
- **Message Validation**: Add message size and content validation.
- **CORS**: Configure CORS headers based on your requirements.

## Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

MIT License - see LICENSE file for details

## Support

- Create an issue for bug reports or feature requests
- Check existing issues before creating new ones
- Provide detailed information for bug reports

## Acknowledgments

- Built with [Gorilla WebSocket](https://github.com/gorilla/websocket)
- Proxy powered by [Caddy](https://caddyserver.com/)
- Deployment automated with GitHub Actions# Triggering workflow
# Triggering deployment with working SSH
