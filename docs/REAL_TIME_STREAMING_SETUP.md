# Real-Time Streaming Setup Guide

This guide shows you how to configure real-time streaming updates for the Claude Code Streaming node, enabling immediate progress feedback during long operations.

## 🎯 Problem Solved

**Before**: Silent long requests with no feedback until completion
**After**: Live progress updates showing exactly what Claude is doing

## 🔧 Setup Steps

### Step 1: Import Webhook Handler Workflow

1. **Import the workflow**: 
   - In n8n, go to **Workflows** → **Import from File**
   - Import `/workflows/streaming-webhook-handler.json`
   - Activate the workflow

2. **Note the webhook URL**: 
   - The webhook path is: `/webhook/claude-streaming`
   - Full URL: `https://your-n8n-instance/webhook/claude-streaming`

### Step 2: Configure Claude Code Node

1. **Open your Claude Code Streaming node**
2. **Navigate to Streaming Options**
3. **Set Real-Time Webhook URL**:
   ```
   https://your-n8n-instance/webhook/claude-streaming
   ```

### Step 3: Test the Setup

1. **Create a test workflow**:
   ```
   Manual Trigger → Claude Code Streaming → Final Output
   ```

2. **Use a long-running prompt**:
   ```
   "Analyze this entire codebase, create a comprehensive report, 
   and suggest improvements for each file"
   ```

3. **Watch for real-time updates** in your Slack channel

## 📊 What You'll See

### Real-Time Update Examples

**Tool Usage:**
```
🔧 Using Tool (Live Update)
Request: Analyze this entire codebase...
Type: Real-time Streaming

TOOL_USE: Using tool: Read
Details: 
  tool_name: Read
  file_path: src/index.ts
```

**Claude Response:**
```
💬 Claude Response (Live Update)
Request: Analyze this entire codebase...
Type: Real-time Streaming

TEXT: I'm analyzing your TypeScript project structure. 
I can see you have a well-organized codebase with...
```

**Status Updates:**
```
✅ Status Update (Live Update)
Request: Analyze this entire codebase...
Type: Real-time Streaming

STATUS: Execution completed
Details:
  success: true
  duration_ms: 45000
  total_cost_usd: 0.12
```

## 🎛️ Filtering Rules

The webhook handler intelligently filters messages to reduce noise:

### **Always Shown:**
- 🔧 **Tool usage**: Every tool execution (Read, Write, Bash, etc.)
- ❌ **Errors**: Any execution errors
- ✅ **Status updates**: Completion events

### **Conditionally Shown:**
- 💬 **Text responses**: Only if >50 characters (significant content)

### **Never Shown:**
- Short text snippets (<50 chars)
- Internal processing messages
- Debug information

## 🔗 Workflow Integration

### Basic Integration
```
Claude Code Streaming → Send Final Response
             ↓
    (Real-time webhook updates happen automatically)
```

### Advanced Integration
```
Claude Code Streaming 
├── Output 1 → Process Final Results → Notifications
└── Output 2 → Format Streaming → Live Progress Updates
```

## 🛠️ Customization Options

### Modify Filtering Logic
Edit the webhook handler's `shouldCreateSlackUpdate()` function:

```javascript
function shouldCreateSlackUpdate(blockMessage) {
  // Always update on important events
  if (blockMessage.type === 'tool_use' || 
      blockMessage.type === 'error' || 
      blockMessage.type === 'status') {
    return true;
  }
  
  // Custom logic for text blocks
  if (blockMessage.type === 'text' && blockMessage.content.length > 100) {
    return true;
  }
  
  return false;
}
```

### Change Slack Formatting
Modify the `createSlackBlockKit()` function to customize the Block Kit format:

```javascript
const blocks = [
  {
    "type": "section",
    "text": {
      "type": "mrkdwn", 
      "text": `${statusInfo.icon} *${statusInfo.text}* (Custom Format)`
    }
  },
  // Add more blocks as needed
];
```

### Add Additional Metadata
Include more context in webhook payloads by modifying the Claude Code node HTTP request:

```typescript
body: {
  blockMessage,
  context: originalContext,
  timestamp: new Date().toISOString(),
  source: 'claude-code-streaming-node',
  customData: {
    userId: context.user_id,
    workflowId: 'your-workflow-id'
  }
}
```

## 🚨 Troubleshooting

### Webhook Not Receiving Data
1. **Check URL**: Ensure webhook URL is correct and accessible
2. **Test endpoint**: Use curl to test webhook manually:
   ```bash
   curl -X POST https://your-n8n-instance/webhook/claude-streaming \
     -H "Content-Type: application/json" \
     -d '{"test": "message"}'
   ```
3. **Check n8n logs**: Look for webhook execution logs

### No Real-Time Updates
1. **Verify configuration**: Check webhook URL in Claude Code node
2. **Enable debug mode**: Turn on debug logging in Claude Code node
3. **Check filtering**: Ensure your messages pass the filtering rules

### Webhook Errors
1. **Check timeout**: Default 5-second timeout might be too short
2. **Verify credentials**: Ensure Slack credentials are correct
3. **Test webhook workflow**: Run webhook handler manually

### Too Many Updates
1. **Adjust filtering**: Increase minimum text length for updates
2. **Disable certain types**: Comment out unwanted message types
3. **Add rate limiting**: Implement delays between messages

## 📈 Performance Considerations

### Webhook Performance
- **Non-blocking**: Webhook calls don't slow down Claude execution
- **Timeout**: 5-second timeout prevents hanging
- **Error handling**: Webhook failures don't affect main workflow

### Slack Rate Limits
- **Built-in filtering** reduces message volume
- **Thread organization** keeps updates contained
- **Smart batching** for rapid-fire updates

### Resource Usage
- **Minimal overhead**: HTTP requests are lightweight
- **Parallel processing**: Doesn't block main execution
- **Memory efficient**: No additional storage required

## 🔐 Security Considerations

### Webhook Security
- **Use HTTPS**: Always use secure webhook URLs
- **Validate payloads**: Verify webhook data structure
- **Rate limiting**: Implement if needed for high-volume workflows

### Data Privacy
- **Context filtering**: Only send necessary context data
- **Credential isolation**: Keep Slack credentials secure
- **Audit logging**: Monitor webhook activity

## 📚 Advanced Usage

### Multiple Webhooks
Configure different webhook URLs for different types of updates:

```typescript
// In Claude Code node
const webhookUrls = {
  tools: streamingOptions.toolWebhookUrl,
  errors: streamingOptions.errorWebhookUrl,
  status: streamingOptions.statusWebhookUrl
};

// Send to appropriate webhook based on message type
const webhookUrl = webhookUrls[blockMessage.type] || streamingOptions.webhookUrl;
```

### Conditional Streaming
Enable streaming only for certain conditions:

```typescript
// Only stream for long-running operations
const shouldStream = maxTurns > 10 || timeout > 300;
if (shouldStream && streamingOptions.webhookUrl) {
  // Send webhook update
}
```

### Custom Block Message Types
Add your own block message types:

```typescript
// In Claude Code node
const customBlock = createBlockMessage('custom', 'Custom event occurred', {
  eventType: 'user_defined',
  metadata: customData
});
```

## 📞 Support

If you encounter issues with real-time streaming:

1. **Check the logs**: Enable debug mode and review console output
2. **Test incrementally**: Start with simple webhook tests
3. **Review examples**: Use the provided workflow templates
4. **Open an issue**: Report bugs in the GitHub repository

---

**Real-time streaming transforms long Claude Code operations from silent black boxes into transparent, trackable processes.** 🚀