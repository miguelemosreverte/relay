const WebSocket = require('ws');
const fs = require('fs');

async function runBenchmark() {
    console.log('🚀 Running benchmark against https://95.217.238.72.nip.io');
    
    const results = {
        timestamp: new Date().toISOString(),
        commit: process.env.GITHUB_SHA || 'test-local',
        metrics: {
            messages_per_second: 0,
            bandwidth_mbps: 0,
            total_messages: 0,
            total_bytes: 0,
            latency_ms: 0,
            connected_users: 2
        }
    };
    
    const startTime = Date.now();
    let messagesSent = 0;
    let messagesReceived = 0;
    let bytesTransferred = 0;
    let latencies = [];
    
    try {
        // Create two WebSocket connections
        const ws1 = new WebSocket('wss://95.217.238.72.nip.io/ws/bench1');
        const ws2 = new WebSocket('wss://95.217.238.72.nip.io/ws/bench2');
        
        await new Promise((resolve, reject) => {
            let ws1Open = false;
            let ws2Open = false;
            
            ws1.on('open', () => {
                console.log('Client 1 connected');
                ws1Open = true;
                if (ws2Open) startTest();
            });
            
            ws2.on('open', () => {
                console.log('Client 2 connected');
                ws2Open = true;
                if (ws1Open) startTest();
            });
            
            ws1.on('error', (err) => {
                console.error('WS1 Error:', err.message);
                reject(err);
            });
            ws2.on('error', (err) => {
                console.error('WS2 Error:', err.message);
                reject(err);
            });
            
            function startTest() {
                console.log('Starting benchmark test...');
                // Send messages for 5 seconds
                const interval = setInterval(() => {
                    if (Date.now() - startTime > 5000) {
                        clearInterval(interval);
                        
                        // Calculate results
                        const duration = (Date.now() - startTime) / 1000;
                        results.metrics.messages_per_second = messagesReceived / duration;
                        results.metrics.total_messages = messagesReceived;
                        results.metrics.total_bytes = bytesTransferred;
                        results.metrics.bandwidth_mbps = (bytesTransferred * 8) / (duration * 1000000);
                        if (latencies.length > 0) {
                            results.metrics.latency_ms = latencies.reduce((a, b) => a + b, 0) / latencies.length;
                        }
                        
                        ws1.close();
                        ws2.close();
                        resolve();
                        return;
                    }
                    
                    const sendTime = Date.now();
                    const msg = JSON.stringify({
                        id: messagesSent++,
                        timestamp: sendTime,
                        data: 'x'.repeat(1000)
                    });
                    ws1.send(msg);
                    bytesTransferred += msg.length;
                }, 10);
            }
            
            ws2.on('message', (data) => {
                messagesReceived++;
                try {
                    const msg = JSON.parse(data);
                    if (msg.timestamp) {
                        latencies.push(Date.now() - msg.timestamp);
                    }
                } catch {}
            });
        });
        
    } catch (error) {
        console.error('Benchmark error:', error.message);
        results.error = error.message;
    }
    
    console.log('✅ Benchmark complete!');
    console.log('  Throughput:', results.metrics.messages_per_second.toFixed(2), 'msg/s');
    console.log('  Bandwidth:', results.metrics.bandwidth_mbps.toFixed(2), 'Mbps');
    console.log('  Latency:', results.metrics.latency_ms.toFixed(2), 'ms');
    console.log('  Total Messages:', results.metrics.total_messages);
    
    // Save results
    fs.writeFileSync('benchmark-results.json', JSON.stringify(results, null, 2));
    console.log('Results saved to benchmark-results.json');
}

runBenchmark().catch(console.error);