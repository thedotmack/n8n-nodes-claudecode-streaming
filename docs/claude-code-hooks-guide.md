# Claude Code Hooks Integration Guide

This guide explains how to use the comprehensive Claude Code hooks and MCP (Model Context Protocol) integration features in the n8n Claude Code Streaming node.

## Overview

The n8n Claude Code Streaming node now exposes Claude Code's full extensibility through:

- **MCP Server Configuration**: Connect to external tools and services
- **Claude Code Hooks**: Custom workflows and automation
- **Advanced Configuration**: Fine-tuned control over execution
- **Session Management**: Conversation continuity and context

## MCP Server Configuration

### Supported Transport Types

#### 1. Stdio Transport
For local command-line tools and scripts:

```json
{
  "name": "local-server",
  "transport": "stdio", 
  "command": "npx",
  "args": ["-y", "@modelcontextprotocol/server-filesystem", "/path/to/directory"],
  "env": {
    "variables": [
      {
        "name": "API_KEY",
        "value": "your-api-key"
      }
    ]
  }
}
```

#### 2. HTTP Transport
For REST API integrations:

```json
{
  "name": "api-server",
  "transport": "http",
  "url": "https://api.example.com/mcp",
  "headers": {
    "headers": [
      {
        "name": "Authorization", 
        "value": "Bearer your-token"
      }
    ]
  }
}
```

#### 3. SSE Transport
For real-time streaming connections:

```json
{
  "name": "streaming-server",
  "transport": "sse",
  "url": "https://api.example.com/sse",
  "headers": {
    "headers": [
      {
        "name": "X-API-Key",
        "value": "your-key"
      }
    ]
  }
}
```

### Popular MCP Servers

| Server | Transport | Description | Configuration |
|--------|-----------|-------------|---------------|
| GitHub | SSE | Repository management | `https://api.github.com/mcp` |
| Slack | Stdio | Team communication | `npx @modelcontextprotocol/server-slack` |
| PostgreSQL | Stdio | Database access | `npx @modelcontextprotocol/server-postgres` |
| Filesystem | Stdio | File operations | `npx @modelcontextprotocol/server-filesystem` |
| Notion | HTTP | Documentation | `https://mcp.notion.com/mcp` |
| Linear | SSE | Issue tracking | `https://mcp.linear.app/sse` |

## Claude Code Hooks

### Hook Types

#### 1. PreToolUse Hooks
Execute before tool usage for validation and control:

```json
{
  "matcher": "Edit|Write|MultiEdit",
  "command": "python3 /path/to/file-validator.py",
  "permissionDecision": "ask"
}
```

**Permission Decisions:**
- `allow`: Automatically approve tool execution
- `deny`: Block tool execution
- `ask`: Prompt user for confirmation

#### 2. PostToolUse Hooks
Execute after tool usage for cleanup and formatting:

```json
{
  "matcher": "Edit|Write",
  "command": "prettier --write $file_path"
}
```

#### 3. SessionStart Hooks
Execute at session start for context injection:

```json
{
  "command": "/path/to/context-injector.py",
  "additionalContext": "Project guidelines and coding standards..."
}
```

### Hook Matchers

Hook matchers support regex patterns to target specific tools:

| Pattern | Matches | Description |
|---------|---------|-------------|
| `Edit` | Edit tool only | Single tool match |
| `Edit\|Write` | Edit or Write tools | Multiple tools |
| `mcp__.*__write.*` | All MCP write operations | MCP tool pattern |
| `Bash` | Bash commands | Command execution |
| `.*` | All tools | Universal matcher |

### Example Hook Configurations

#### File Protection Hook
Prevent editing of sensitive files:

```json
{
  "matcher": "Edit|MultiEdit|Write",
  "command": "python3 -c \"import json, sys; data=json.load(sys.stdin); path=data.get('tool_input',{}).get('file_path',''); sys.exit(2 if any(p in path for p in ['.env', 'package-lock.json', '.git/']) else 0)\"",
  "permissionDecision": "deny"
}
```

#### Code Formatting Hook
Automatically format code after edits:

```json
{
  "matcher": "Edit|Write",
  "command": "jq -r '.tool_input.file_path' | { read file_path; if echo \"$file_path\" | grep -q '\\.py$' ; then python3 -m black \"$file_path\"; fi; }"
}
```

#### MCP Operation Logging
Log all MCP operations:

```json
{
  "matcher": "mcp__.*__.*",
  "command": "echo \"$(date): MCP operation $(jq -r '.tool_name')\" >> /tmp/mcp-operations.log"
}
```

## Advanced Configuration

### Permission Modes

| Mode | Description | Use Case |
|------|-------------|----------|
| `default` | Standard permission prompts | Interactive development |
| `acceptEdits` | Auto-accept file edits | Automated workflows |
| `plan` | Planning mode without execution | Code review and analysis |
| `bypassPermissions` | Skip all permission prompts | Trusted environments |

### Session Management

| Mode | Description | Configuration |
|------|-------------|---------------|
| `new` | Start fresh session | Default behavior |
| `continue` | Continue latest conversation | Maintains context |
| `resume` | Resume specific session | Requires `sessionId` |

### Environment Variables

Configure runtime environment:

```json
{
  "variables": [
    {
      "name": "NODE_ENV",
      "value": "production"
    },
    {
      "name": "API_BASE_URL", 
      "value": "https://api.example.com"
    }
  ]
}
```

### Telemetry Configuration

Enable OpenTelemetry monitoring:

```json
{
  "enableTelemetry": true,
  "telemetryConfig": {
    "configs": [
      {
        "name": "OTEL_EXPORTER_OTLP_ENDPOINT",
        "value": "http://collector.company.com:4317"
      },
      {
        "name": "OTEL_METRICS_EXPORTER",
        "value": "otlp"
      }
    ]
  }
}
```

## Best Practices

### 1. MCP Server Security
- Use environment variables for sensitive data
- Implement proper authentication headers
- Validate server certificates for HTTPS endpoints
- Use scoped permissions (local > project > user)

### 2. Hook Design
- Keep hook commands lightweight and fast
- Use proper error handling in hook scripts
- Log hook executions for debugging
- Test hooks thoroughly before deployment

### 3. Session Management
- Use `continue` mode for conversational workflows
- Implement session cleanup for long-running processes
- Store session IDs for important conversations
- Monitor session resource usage

### 4. Performance Optimization
- Cache MCP server responses when possible
- Use streaming for real-time updates
- Implement proper timeout handling
- Monitor telemetry data for bottlenecks

## Troubleshooting

### Common Issues

#### MCP Server Connection Failures
```bash
# Check server availability
curl -v https://api.example.com/mcp

# Verify authentication
claude mcp list
claude mcp get server-name
```

#### Hook Execution Errors
```bash
# Enable debug logging
"debug": true

# Check hook script permissions
chmod +x /path/to/hook-script.py

# Test hook manually
echo '{"tool_input":{"file_path":"test.py"}}' | python3 /path/to/hook-script.py
```

#### Permission Issues
```bash
# Check Claude Code permissions
claude config get permissions

# Verify file access
ls -la /path/to/working/directory
```

### Debug Configuration

Enable comprehensive debugging:

```json
{
  "advancedConfig": {
    "debug": true,
    "enableTelemetry": true,
    "telemetryConfig": {
      "configs": [
        {
          "name": "OTEL_METRICS_EXPORTER",
          "value": "console"
        },
        {
          "name": "OTEL_METRIC_EXPORT_INTERVAL", 
          "value": "1000"
        }
      ]
    }
  }
}
```

## Examples

See the `workflow-templates/` directory for complete workflow examples:

- `claude-code-mcp-integration.json`: MCP server integration with GitHub and Slack
- `claude-code-advanced-hooks.json`: Comprehensive hooks configuration for development workflows

## Reference

- [Claude Code Documentation](https://docs.anthropic.com/en/docs/claude-code)
- [Model Context Protocol](https://modelcontextprotocol.io/)
- [Claude Code Hooks Guide](https://docs.anthropic.com/en/docs/claude-code/hooks-guide)
- [Available MCP Servers](https://github.com/modelcontextprotocol/servers)