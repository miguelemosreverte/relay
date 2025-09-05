# Performance Tracking

## Accessing Performance Reports

Performance reports are automatically generated and stored for every deployment. Here's how to access them:

### 1. Via GitHub Actions Artifacts

After each deployment, performance reports are uploaded as artifacts:

1. Go to the [Actions tab](../../actions) in this repository
2. Click on any workflow run
3. Scroll down to "Artifacts" section
4. Download `performance-report-{commit-hash}`

Each artifact contains:
- `performance-report.md` - Markdown format report
- `performance-report.html` - HTML format report (viewable in browser)
- `performance-report.json` - Raw JSON data
- `deployment-test-report.md` - Detailed test results

### 2. Via API Endpoints

The live server provides real-time performance data:

```bash
# Get performance report in Markdown
curl -H "Accept: text/markdown" https://YOUR_DOMAIN/test/benchmark

# Get performance report in HTML
curl -H "Accept: text/html" https://YOUR_DOMAIN/test/benchmark

# Get performance report in JSON
curl https://YOUR_DOMAIN/test/benchmark
```

### 3. Historical Performance Tracking

Performance artifacts are retained for 90 days, allowing you to:
- Compare performance across commits
- Track improvements/regressions over time
- Identify performance trends

## Performance Metrics Tracked

Each report includes:

### Server Metrics
- Version and uptime
- Connected users count
- Total messages processed
- Total data relayed

### Performance Metrics
- Message throughput (msg/s)
- Bandwidth usage (Mbps)
- Average latency (ms)
- Connection stability

### Test Results
- Health check validation
- WebSocket relay testing
- 5-second benchmark results
- 10-second stability test

## Viewing Performance Trends

To view performance over time:

1. Download multiple artifacts from different commits
2. Compare the metrics in the reports
3. Look for patterns in:
   - Throughput changes
   - Latency variations
   - Bandwidth usage
   - Test success rates

## Performance Baselines

Target performance metrics:
- **Throughput:** > 100 messages/second
- **Latency:** < 50ms average
- **Bandwidth:** Scales with usage
- **Uptime:** 99.9% availability

## Alerts and Monitoring

The deployment workflow will:
- ✅ Pass if all tests succeed
- ⚠️ Warn if some tests fail but deployment succeeds
- ❌ Rollback if deployment verification fails

## Example Report

```markdown
# WebSocket Relay Server - Performance Report

**Generated:** 2025-01-05T12:34:56Z

## Server Status
- **Version:** 1.0.0
- **Uptime:** 3600 seconds
- **Connected Users:** 5

## Performance Metrics
- **Total Messages:** 125000
- **Total Data:** 256.50 MB
- **Throughput:** 347.22 msg/s
- **Bandwidth:** 0.57 Mbps

## Test Information
- **Test Duration:** 5ms
- **Deployment:** abc123def
```