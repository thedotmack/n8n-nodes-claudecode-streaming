# 🚀 Claude Code n8n Workflow Templates

Ready-to-use workflow templates that showcase the power of Claude Code streaming in n8n automation with real-time block message updates.

## 📦 Available Templates

### 1. 🐛 [Automatic Bug Fixer](./automatic-bug-fixer.json)
**Trigger**: GitHub Issue webhook  
**What it does**: 
- Analyzes bug reports from GitHub issues
- Searches codebase for the root cause
- Generates and tests a fix
- Creates a pull request with the solution
- Comments on the issue with the fix details

**Perfect for**: Teams wanting to automate bug fixes for common issues

---

### 2. 📚 [Documentation Generator](./codebase-documentation-generator.json)
**Trigger**: Weekly schedule  
**What it does**:
- Scans entire codebase for changes
- Updates API documentation
- Creates architecture diagrams
- Generates setup guides
- Builds documentation site

**Perfect for**: Keeping documentation always up-to-date

---

### 3. 🎫 [Customer Support Automation](./customer-support-automation.json)
**Trigger**: Support ticket webhook  
**What it does**:
- Analyzes customer bug reports
- Reproduces and diagnoses issues
- Generates fixes with tests
- Provides immediate workarounds to customers
- Creates PRs for permanent fixes
- Updates support tickets automatically

**Perfect for**: Reducing support response time from days to minutes

## 🛠️ How to Use These Templates

### Method 1: Import via n8n UI
1. Download the desired `.json` file
2. In n8n, click **Workflows** → **Add Workflow** → **Import from File**
3. Select the downloaded template
4. Update the configuration:
   - Set your `projectPath`
   - Configure webhooks/triggers
   - Update credentials (GitHub, Slack, etc.)

### Method 2: Copy & Paste
1. Open the `.json` file
2. Copy the entire content
3. In n8n, create a new workflow
4. Press `Ctrl+V` (or `Cmd+V` on Mac) to paste

## ⚙️ Configuration Required

### Common Settings to Update

1. **Project Path**: 
   ```javascript
   "projectPath": "/path/to/your/project"  // Update this!
   ```

2. **Node Type**: All templates use the simplified streaming node
   ```javascript
   "type": "claudeCodeStreaming"  // Correct node type
   ```

3. **Streaming Options**: Configure real-time block message streaming
   ```javascript
   "streamingOptions": {
     "enableStreaming": true,
     "includeTimestamps": true
   }
   ```

4. **Webhook URLs**: Each webhook needs a unique path
   ```javascript
   "path": "webhook/your-unique-path"
   ```

5. **External Services**:
   - GitHub: Repository owner and name
   - Slack: Channel names and authentication
   - Email: SMTP settings or service credentials
   - Databases: Connection strings

### Required Credentials

Most templates need these credentials configured in n8n:
- **GitHub**: Personal access token with repo permissions
- **Slack**: Bot token or webhook URL
- **Email**: SMTP or service-specific credentials
- **Databases**: Connection credentials

## 🎯 Tips for Success

### 1. Start Simple
- Test with a single workflow first
- Use manual triggers for testing
- Monitor execution logs

### 2. Customize Prompts
Each template's prompts can be customized:
```javascript
"prompt": "Your custom instructions here"
```

### 3. Adjust Timeouts
For complex operations, increase timeouts:
```javascript
"timeout": 600  // 10 minutes
```

### 4. Control Tool Access
Limit tools for safety:
```javascript
"allowedTools": ["Read", "Grep"]  // Read-only access
```

### 5. Configure Block Message Streaming
Enable real-time updates:
```javascript
"streamingOptions": {
  "enableStreaming": true,     // Enable streaming to second output
  "includeTimestamps": true    // Include timestamps in block messages
}
```

### 6. Use Dual Outputs
Connect both outputs for complete workflow:
- **Output 1 (Main)**: Final results and structured data
- **Output 2 (Streaming)**: Real-time block messages for live updates

## 🔄 **Block Message Streaming Examples**

### Basic Streaming Setup
```json
{
  "type": "claudeCodeStreaming",
  "parameters": {
    "prompt": "Analyze this codebase and fix any issues",
    "streamingOptions": {
      "enableStreaming": true,
      "includeTimestamps": true
    }
  }
}
```

### Connecting Streaming Output
Connect the **second output** to process real-time block messages:
```
Claude Code Streaming → (Output 2) → Slack/Webhook → Real-time Updates
                    → (Output 1) → Final Processing → Results
```

### Block Message Format
Streaming output sends individual BlockMessage objects:
```json
{
  "type": "text|tool_use|status|error",
  "content": "Message content",
  "timestamp": "2024-01-01T12:00:00.000Z",
  "metadata": {
    "tool_name": "Read",
    "messageId": "msg_123"
  }
}
```

### Processing Block Messages
Use the simplified streaming processor:
```javascript
// Process each block message for real-time updates
const blockMessage = $input.first().json;
if (blockMessage.type === 'tool_use') {
  // Send tool usage update to Slack
} else if (blockMessage.type === 'status') {
  // Send completion status
}
```

## 📝 Creating Your Own Templates

### Template Structure
```json
{
  "name": "Your Workflow Name",
  "nodes": [...],
  "connections": {...},
  "settings": {"executionOrder": "v1"},
  "meta": {"templateId": "unique-id"}
}
```

### Best Practices
1. **Clear Naming**: Use descriptive node names
2. **Dual Outputs**: Always connect both main and streaming outputs
3. **Block Processing**: Use streaming output for real-time updates
4. **Error Handling**: Add IF nodes for error cases
5. **Notifications**: Always notify on completion/failure
6. **Documentation**: Add sticky notes explaining complex logic
7. **Testing**: Include test data in pinData for easy testing

## 🚨 Common Issues & Solutions

### "Claude Code not found"
Make sure Claude Code CLI is installed on your n8n server:
```bash
npm install -g @anthropic-ai/claude-code
claude auth
```

### "Webhook not receiving data"
- Check webhook URL is accessible
- Verify webhook path is unique
- Test with tools like `curl` or Postman

### "Timeout errors"
- Increase the timeout value
- Use Sonnet model for faster responses
- Break complex operations into steps

## 🤝 Contributing

Have a great workflow template? We'd love to include it!

1. Create your workflow in n8n
2. Export it as JSON
3. Add clear documentation
4. Submit a PR to this repository

## 📚 Learn More

- [Claude Code Documentation](https://docs.anthropic.com/claude-code)
- [n8n Documentation](https://docs.n8n.io)
- [Main README](../README.md)

---

**Questions?** Open an issue in our [GitHub repository](https://github.com/holt-web-ai/n8n-nodes-claudecode/issues)!