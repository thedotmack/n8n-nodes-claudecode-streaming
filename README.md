# n8n-nodes-claudecode-streaming

**Claude Code SDK integration with real-time block message streaming for n8n**

An n8n community node package that integrates Claude Code SDK with **real-time streaming updates**. See Claude working in real-time through structured block messages with immediate Slack notifications, tool usage tracking, and live progress updates during long operations.

[![n8n](https://img.shields.io/badge/n8n-community_node-orange.svg)](https://n8n.io/)
[![Claude Code](https://img.shields.io/badge/Claude%20Code-Powered-blue.svg)](https://claude.ai/code)
[![npm](https://img.shields.io/npm/v/@thedotmack/n8n-nodes-claudecode-streaming.svg)](https://www.npmjs.com/package/@thedotmack/n8n-nodes-claudecode-streaming)
[![License](https://img.shields.io/badge/license-MIT-green.svg)](LICENSE.md)

## 🌟 What Can You Build?

### 🔧 **Automated Code Reviews**
Create workflows that automatically review pull requests, suggest improvements, and even fix issues before merging.

### 🐛 **Intelligent Bug Fixing**
Connect error monitoring tools to Claude Code - automatically diagnose and fix production issues in real-time.

### 📊 **Database Management**
Let Claude Code write complex SQL queries, optimize database schemas, and generate migration scripts based on your requirements.

### 🤖 **Self-Improving Workflows**
Build n8n workflows that can modify and improve themselves using Claude Code's capabilities.

### 📝 **Documentation Generation**
Automatically generate and update documentation for your entire codebase, APIs, or databases.

### 🔄 **Code Migration**
Automate the migration of legacy codebases to modern frameworks with intelligent refactoring.

### 🎫 **Customer Support Automation**
Transform support tickets into code fixes automatically:
- Analyze customer bug reports and reproduce issues
- Generate fixes for reported problems
- Create test cases to prevent regression
- Update documentation based on common questions
- Auto-respond with workarounds while fixes are deployed

## ⚡ Quick Start

### Prerequisites
1. **Claude Code CLI** (required on your n8n server):
   ```bash
   npm install -g @anthropic-ai/claude-code
   claude  # Authenticate (requires Claude Pro/Team subscription)
   ```

### Install in n8n

#### Option 1: Via n8n UI (Recommended)
1. Open your n8n instance
2. Go to **Settings** → **Community Nodes**
3. Click **Install a community node**
4. Enter: `@holtweb/n8n-nodes-claudecode`
5. Click **Install**
6. Restart n8n when prompted

#### Option 2: Manual Installation
```bash
cd ~/.n8n/nodes
npm install @holtweb/n8n-nodes-claudecode
# Restart n8n
```

#### Option 3: Docker
```bash
docker run -it --rm \
  -p 5678:5678 \
  -e N8N_COMMUNITY_NODE_PACKAGES=@holtweb/n8n-nodes-claudecode \
  -v ~/.n8n:/home/node/.n8n \
  n8nio/n8n
```

**Note**: For Docker, you'll need to ensure Claude Code CLI is installed inside the container. Consider creating a custom Dockerfile.

📦 **NPM Package**: [@holtweb/n8n-nodes-claudecode](https://www.npmjs.com/package/@holtweb/n8n-nodes-claudecode)

## 🎯 Real-World Use Cases

### 1. **GitHub Issue to Code**
```
Webhook (GitHub Issue) → Claude Code → Create PR → Notify Slack
```
Automatically implement features or fix bugs when issues are created.

### 2. **Database Query Builder**
```
Form Trigger → Claude Code → Execute Query → Send Results
```
Natural language to SQL - let non-technical users query databases safely.

### 3. **Code Quality Guardian**
```
Git Push → Claude Code → Analyze Code → Block/Approve → Notify
```
Enforce coding standards and catch issues before they reach production.

### 4. **API Integration Builder**
```
HTTP Request → Claude Code → Generate Integration → Test → Deploy
```
Automatically create integrations with third-party APIs.

### 5. **Intelligent Log Analysis**
```
Error Logs → Claude Code → Diagnose → Create Fix → Open PR
```
Turn error logs into actionable fixes automatically.

### 6. **Customer Support to Code Fix**
```
Support Ticket → Claude Code → Reproduce Issue → Generate Fix → Test → Deploy → Auto-Reply
```
Transform customer complaints into deployed fixes in minutes, not days.

## 🛠️ Powerful Features

### **Project Context Awareness**
Set a project path and Claude Code understands your entire codebase context:
- Analyzes existing code patterns
- Follows your coding standards
- Understands your architecture
- Respects your dependencies

### **Tool Arsenal**
Claude Code comes equipped with powerful tools:
- 📁 **File Operations**: Read, write, edit multiple files
- 💻 **Bash Commands**: Execute any command
- 🔍 **Smart Search**: Find patterns across your codebase
- 🌐 **Web Access**: Fetch documentation and resources
- 📊 **Database Access**: Via MCP servers
- 🔗 **API Integration**: GitHub, Slack, and more via MCP

### **Model Context Protocol (MCP)**
Extend Claude Code with specialized capabilities:
- PostgreSQL/MySQL database access
- GitHub repository management
- Slack workspace integration
- Custom tool development

## 📋 Configuration Examples

### Simple Code Analysis
```javascript
{
  "operation": "query",
  "prompt": "Analyze this codebase and suggest performance improvements",
  "projectPath": "/path/to/your/project",
  "model": "sonnet"
}
```

### Advanced Database Operations
```javascript
{
  "operation": "query",
  "prompt": "Create an optimized query to find users who haven't logged in for 30 days",
  "projectPath": "/path/to/project",
  "model": "opus"
}
```

### Customer Support Automation
```javascript
{
  "operation": "query",
  "prompt": "Customer reports: 'Login button not working on mobile devices'\n\nAnalyze this issue, find the root cause, and create a fix",
  "projectPath": "/path/to/web-app",
  "model": "opus",
  "allowedTools": ["Read", "Write", "Edit", "Bash", "Grep"],
  "additionalOptions": {
    "systemPrompt": "Focus on mobile compatibility issues. Check responsive CSS and JavaScript event handlers."
  }
}
```

## 🎣 Claude Code Hooks Integration

**NEW**: The Claude Code Streaming node now supports Claude Code hooks for advanced workflow customization and security controls.

### What are Claude Code Hooks?

Claude Code hooks allow you to intercept and customize Claude's behavior at key execution points:

- **PreToolUse**: Validate/block tools before execution (security, compliance)
- **PostToolUse**: Process results after tool completion (formatting, logging) 
- **UserPromptSubmit**: Filter/enhance prompts before processing
- **Stop**: Control when Claude can finish execution

### Example: Security Validation

```javascript
// n8n Node Configuration
{
  "prompt": "Help me deploy this application",
  "projectPath": "/path/to/project",
  "hooksConfiguration": {
    "enableHooks": true,
    "hookEvents": {
      "preToolUse": [{
        "matcher": "Bash",
        "command": "python ./hooks/security-validator.py",
        "description": "Block dangerous commands"
      }]
    },
    "hooksOutputMode": "streaming"
  }
}
```

```python
# hooks/security-validator.py
import json, sys
input_data = json.load(sys.stdin)

if "rm -rf" in input_data.get("tool_input", {}).get("command", ""):
    print("Security violation: Dangerous command blocked", file=sys.stderr)
    sys.exit(2)  # Block the operation

print("Security check passed")
sys.exit(0)  # Allow the operation
```

### Real-Time Hook Events

When hooks are enabled, you'll see real-time events in the streaming output:

```json
{
  "type": "status",
  "content": "Pre-tool hook triggered for: Bash", 
  "metadata": {
    "hookType": "PreToolUse",
    "toolName": "Bash",
    "hooksEnabled": true
  }
}
```

### Complete Example

See the [hooks example](./examples/hooks-example/) for a complete implementation with:
- Security validation (blocking dangerous commands)
- Auto-formatting (code cleanup after writing)
- Prompt validation (filtering sensitive content)
- Execution control (managing stop behavior)

With MCP configuration (`.mcp.json`):
```json
{
  "mcpServers": {
    "postgres": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-postgres", "${DATABASE_URL}"]
    }
  }
}
```

## 🔄 Workflow Patterns

### Pattern 1: Continuous Code Improvement
```
Schedule Trigger (Daily)
  ↓
Claude Code (Analyze codebase for improvements)
  ↓
Create GitHub Issues
  ↓
Assign to Team
```

### Pattern 2: Natural Language to Code
```
Slack Command
  ↓
Claude Code (Generate code from description)
  ↓
Create Pull Request
  ↓
Run Tests
  ↓
Notify Results
```

### Pattern 3: Intelligent Monitoring
```
Error Webhook
  ↓
Claude Code (Diagnose issue)
  ↓
If (Can fix automatically)
  ├─ Yes: Create Fix PR
  └─ No: Create Detailed Issue
```

## 🚦 Getting Started

### 1. **Verify Prerequisites**
Make sure Claude Code CLI is installed and authenticated on your n8n server:
```bash
claude --version  # Should show the version
```

If not installed, see the [Quick Start](#-quick-start) section above.

### 2. **Create Your First Workflow**
1. In n8n, create a new workflow
2. Add a **Manual Trigger** node (for testing)
3. Add the **Claude Code** node
4. Configure:
   - **Operation**: Query
   - **Prompt**: "Analyze the code in this directory and suggest improvements"
   - **Project Path**: `/path/to/your/project`
   - **Model**: Sonnet (faster) or Opus (more powerful)
5. Click **Execute Workflow**
6. Watch Claude Code analyze your project!

### 3. **Explore Advanced Features**
- Check out the [workflow templates](./workflow-templates/) for ready-to-use examples
- See the [examples directory](./examples/) for configuration options
- Read about [MCP servers](#model-context-protocol-mcp) for database and API access

## 💡 Pro Tips

### 🎯 **Use Project Paths**
Always set a project path for better context and results:
```
/home/user/projects/my-app
```

### 🔒 **Configure Permissions**
Control what Claude Code can do in `.claude/settings.json`:
```json
{
  "permissions": {
    "allow": ["Read(*)", "Write(*)", "Bash(npm test)"],
    "deny": ["Bash(rm -rf *)"]
  }
}
```

### 🔗 **Chain Operations**
Use "Continue" operation to build complex multi-step workflows while maintaining context.

### 📊 **Output Formats**
- **Structured**: Full details with metrics
- **Messages**: For debugging
- **Text**: Simple results for chaining

## 🤝 Community & Support

- 📖 [Documentation](https://github.com/holt-web-ai/n8n-nodes-claudecode)
- 🐛 [Report Issues](https://github.com/holt-web-ai/n8n-nodes-claudecode/issues)
- 💬 [Discussions](https://github.com/holt-web-ai/n8n-nodes-claudecode/discussions)
- 🌟 [Star on GitHub](https://github.com/holt-web-ai/n8n-nodes-claudecode)

## 📈 What's Next?

We're constantly improving! Upcoming features:
- Visual workflow builder for Claude Code operations
- Pre-built workflow templates
- Enhanced debugging tools
- More MCP server integrations

## 📄 License

MIT - Build amazing things!

---

**Ready to revolutionize your development workflow?** Install Claude Code for n8n today and join the future of automated software development!

Made with ❤️ by [Adam Holt](https://github.com/holt-web-ai)