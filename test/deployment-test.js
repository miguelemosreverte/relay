#!/usr/bin/env node

const WebSocket = require('ws');
const https = require('https');
const fs = require('fs');

class DeploymentTester {
    constructor(domain) {
        this.domain = domain;
        this.wsUrl = `wss://${domain}/ws`;
        this.healthUrl = `https://${domain}/health`;
        this.results = {
            health: { passed: false, details: {} },
            websocket: { passed: false, details: {} },
            benchmark: { passed: false, details: {} }
        };
    }

    // Test 1: Health Check
    async testHealth() {
        console.log('\n🏥 Testing Health Endpoint...');
        
        return new Promise((resolve) => {
            https.get(this.healthUrl, (res) => {
                let data = '';
                res.on('data', chunk => data += chunk);
                res.on('end', () => {
                    try {
                        const health = JSON.parse(data);
                        
                        // Check required fields
                        const required = ['status', 'deployment', 'metrics'];
                        const missing = required.filter(field => !health[field]);
                        
                        if (missing.length === 0 && health.status === 'healthy') {
                            this.results.health.passed = true;
                            this.results.health.details = {
                                status: health.status,
                                commit: health.deployment?.commit?.substring(0, 7),
                                actor: health.deployment?.actor,
                                uptime: health.server?.uptime_seconds,
                                users: health.metrics?.connected_users
                            };
                            console.log('✅ Health check passed');
                        } else {
                            console.log('❌ Health check failed:', missing);
                        }
                    } catch (e) {
                        console.log('❌ Health check failed:', e.message);
                    }
                    resolve();
                });
            }).on('error', (e) => {
                console.log('❌ Health check failed:', e.message);
                resolve();
            });
        });
    }

    // Test 2: WebSocket Connection
    async testWebSocket() {
        console.log('\n🔌 Testing WebSocket Connection...');
        
        return new Promise((resolve) => {
            const timeout = setTimeout(() => {
                console.log('❌ WebSocket test timeout');
                resolve();
            }, 10000);

            const ws1 = new WebSocket(`${this.wsUrl}/test-user-1`);
            const ws2 = new WebSocket(`${this.wsUrl}/test-user-2`);
            
            let connected = 0;
            let messageReceived = false;
            
            ws1.on('open', () => {
                connected++;
                console.log('  User 1 connected');
                if (connected === 2) {
                    // Send test message
                    ws1.send(JSON.stringify({ type: 'test', data: 'Hello from user 1' }));
                }
            });
            
            ws2.on('open', () => {
                connected++;
                console.log('  User 2 connected');
            });
            
            ws2.on('message', (data) => {
                messageReceived = true;
                console.log('  Message relayed successfully');
                
                this.results.websocket.passed = true;
                this.results.websocket.details = {
                    connection: 'successful',
                    relay: 'working',
                    latency: 'low'
                };
                
                console.log('✅ WebSocket test passed');
                
                clearTimeout(timeout);
                ws1.close();
                ws2.close();
                resolve();
            });
            
            ws1.on('error', (e) => {
                console.log('❌ WebSocket error:', e.message);
                clearTimeout(timeout);
                resolve();
            });
            
            ws2.on('error', (e) => {
                console.log('❌ WebSocket error:', e.message);
                clearTimeout(timeout);
                resolve();
            });
        });
    }

    // Test 3: Quick Benchmark (5 seconds)
    async testBenchmark() {
        console.log('\n⚡ Running Quick Benchmark (5 seconds)...');
        
        return new Promise((resolve) => {
            const startTime = Date.now();
            const duration = 5000; // 5 seconds
            const messageSize = 1024; // 1KB messages
            const messageData = 'x'.repeat(messageSize);
            
            let messagesSent = 0;
            let messagesReceived = 0;
            let totalLatency = 0;
            
            const ws1 = new WebSocket(`${this.wsUrl}/bench-sender`);
            const ws2 = new WebSocket(`${this.wsUrl}/bench-receiver`);
            
            ws1.on('open', () => {
                console.log('  Starting benchmark...');
                
                // Send messages continuously
                const interval = setInterval(() => {
                    if (Date.now() - startTime > duration) {
                        clearInterval(interval);
                        
                        // Calculate results
                        const elapsed = (Date.now() - startTime) / 1000;
                        const throughput = messagesReceived / elapsed;
                        const avgLatency = messagesReceived > 0 ? totalLatency / messagesReceived : 0;
                        const bandwidth = (messagesReceived * messageSize * 8) / (elapsed * 1000000); // Mbps
                        
                        this.results.benchmark.passed = throughput > 10; // At least 10 msg/s
                        this.results.benchmark.details = {
                            duration: `${elapsed}s`,
                            messages_sent: messagesSent,
                            messages_received: messagesReceived,
                            throughput: `${throughput.toFixed(1)} msg/s`,
                            avg_latency: `${avgLatency.toFixed(1)}ms`,
                            bandwidth: `${bandwidth.toFixed(2)} Mbps`
                        };
                        
                        if (this.results.benchmark.passed) {
                            console.log('✅ Benchmark passed');
                        } else {
                            console.log('❌ Benchmark failed: Low throughput');
                        }
                        
                        console.log(`  Throughput: ${throughput.toFixed(1)} msg/s`);
                        console.log(`  Latency: ${avgLatency.toFixed(1)}ms`);
                        console.log(`  Bandwidth: ${bandwidth.toFixed(2)} Mbps`);
                        
                        ws1.close();
                        ws2.close();
                        resolve();
                        return;
                    }
                    
                    const timestamp = Date.now();
                    ws1.send(JSON.stringify({
                        id: messagesSent++,
                        timestamp,
                        data: messageData
                    }));
                }, 10); // Send every 10ms (100 msg/s target)
            });
            
            ws2.on('message', (data) => {
                try {
                    const msg = JSON.parse(data);
                    messagesReceived++;
                    totalLatency += Date.now() - msg.timestamp;
                } catch (e) {
                    // Handle non-JSON messages
                }
            });
            
            ws1.on('error', () => resolve());
            ws2.on('error', () => resolve());
        });
    }

    // Generate report
    generateReport() {
        console.log('\n📊 Generating Test Report...\n');
        
        const allPassed = Object.values(this.results).every(r => r.passed);
        
        // Markdown report
        let markdown = '# Deployment Test Report\n\n';
        markdown += `**Date:** ${new Date().toISOString()}\n`;
        markdown += `**Domain:** ${this.domain}\n`;
        markdown += `**Overall Status:** ${allPassed ? '✅ PASSED' : '❌ FAILED'}\n\n`;
        
        markdown += '## Test Results\n\n';
        
        // Health Check
        markdown += '### 🏥 Health Check\n';
        markdown += `- **Status:** ${this.results.health.passed ? '✅ Passed' : '❌ Failed'}\n`;
        if (this.results.health.passed) {
            const d = this.results.health.details;
            markdown += `- **Server Status:** ${d.status}\n`;
            markdown += `- **Deployment:** ${d.commit} by ${d.actor}\n`;
            markdown += `- **Uptime:** ${Math.round(d.uptime)}s\n`;
            markdown += `- **Connected Users:** ${d.users}\n`;
        }
        markdown += '\n';
        
        // WebSocket Test
        markdown += '### 🔌 WebSocket Relay\n';
        markdown += `- **Status:** ${this.results.websocket.passed ? '✅ Passed' : '❌ Failed'}\n`;
        if (this.results.websocket.passed) {
            const d = this.results.websocket.details;
            markdown += `- **Connection:** ${d.connection}\n`;
            markdown += `- **Message Relay:** ${d.relay}\n`;
        }
        markdown += '\n';
        
        // Benchmark
        markdown += '### ⚡ Performance Benchmark\n';
        markdown += `- **Status:** ${this.results.benchmark.passed ? '✅ Passed' : '❌ Failed'}\n`;
        if (this.results.benchmark.details.duration) {
            const d = this.results.benchmark.details;
            markdown += `- **Duration:** ${d.duration}\n`;
            markdown += `- **Throughput:** ${d.throughput}\n`;
            markdown += `- **Avg Latency:** ${d.avg_latency}\n`;
            markdown += `- **Bandwidth:** ${d.bandwidth}\n`;
            markdown += `- **Messages:** ${d.messages_received}/${d.messages_sent} received\n`;
        }
        markdown += '\n';
        
        // Summary
        markdown += '## Summary\n\n';
        if (allPassed) {
            markdown += '✅ **All tests passed successfully!** The deployment is working correctly.\n';
        } else {
            const failed = Object.entries(this.results)
                .filter(([k, v]) => !v.passed)
                .map(([k]) => k);
            markdown += `❌ **Failed tests:** ${failed.join(', ')}\n`;
            markdown += 'The deployment may have issues that need investigation.\n';
        }
        
        // Save report
        fs.writeFileSync('deployment-test-report.md', markdown);
        console.log('📄 Report saved to deployment-test-report.md');
        
        // Also output to console
        console.log('\n' + markdown);
        
        // Return exit code
        return allPassed ? 0 : 1;
    }

    async run() {
        console.log(`🚀 Starting Deployment Tests for ${this.domain}`);
        console.log('=' . repeat(50));
        
        await this.testHealth();
        await this.testWebSocket();
        await this.testBenchmark();
        
        const exitCode = this.generateReport();
        
        console.log('\n' + '=' . repeat(50));
        console.log(`Tests completed. Exit code: ${exitCode}`);
        
        process.exit(exitCode);
    }
}

// Run tests
const domain = process.argv[2];
if (!domain) {
    console.error('Usage: node deployment-test.js <domain>');
    process.exit(1);
}

const tester = new DeploymentTester(domain);
tester.run().catch(console.error);