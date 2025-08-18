# Claude Code Hooks Integration Example

This example demonstrates how to use Claude Code hooks in your n8n workflows with the Claude Code Streaming node.

## Overview

Claude Code hooks allow you to intercept and customize the behavior of Claude Code at various points during execution:

- **PreToolUse**: Execute commands before Claude uses a tool
- **PostToolUse**: Execute commands after Claude completes a tool
- **UserPromptSubmit**: Execute commands when a user prompt is submitted
- **Stop**: Execute commands when Claude tries to stop execution

## Example Hook Scripts

### 1. Security Validation Hook (PreToolUse)

```python
#!/usr/bin/env python3
# File: hooks/security-validator.py
import json
import sys

# Load hook input from stdin
input_data = json.load(sys.stdin)

tool_name = input_data.get("tool_name", "")
tool_input = input_data.get("tool_input", {})

# Block dangerous operations
if tool_name == "Bash":
    command = tool_input.get("command", "")
    dangerous_commands = ["rm -rf", "sudo", "format"]
    
    if any(cmd in command for cmd in dangerous_commands):
        # Exit with code 2 to block the operation
        print("Security violation: Dangerous command blocked", file=sys.stderr)
        sys.exit(2)

# Block writes to sensitive files
if tool_name == "Write":
    file_path = tool_input.get("file_path", "")
    if ".env" in file_path or "secrets" in file_path:
        print("Security violation: Cannot write to sensitive files", file=sys.stderr)
        sys.exit(2)

# Allow the operation
print("Security check passed")
sys.exit(0)
```

### 2. Auto-formatter Hook (PostToolUse)

```python
#!/usr/bin/env python3
# File: hooks/auto-formatter.py
import json
import sys
import subprocess

# Load hook input from stdin
input_data = json.load(sys.stdin)

tool_name = input_data.get("tool_name", "")
tool_input = input_data.get("tool_input", {})

# Auto-format Python files after writing
if tool_name == "Write":
    file_path = tool_input.get("file_path", "")
    if file_path.endswith(".py"):
        try:
            subprocess.run(["black", file_path], check=True)
            print(f"Auto-formatted: {file_path}")
        except subprocess.CalledProcessError:
            print(f"Failed to format: {file_path}")

sys.exit(0)
```

### 3. Prompt Validator Hook (UserPromptSubmit)

```python
#!/usr/bin/env python3
# File: hooks/prompt-validator.py
import json
import sys
import re

# Load hook input from stdin
input_data = json.load(sys.stdin)

prompt = input_data.get("prompt", "")

# Check for sensitive patterns
sensitive_patterns = [
    r"(?i)\b(password|secret|key|token)\s*[:=]",
    r"(?i)delete\s+all",
]

for pattern in sensitive_patterns:
    if re.search(pattern, prompt):
        # Block the prompt
        output = {
            "decision": "block",
            "reason": "Prompt contains potentially sensitive information"
        }
        print(json.dumps(output))
        sys.exit(0)

# Allow the prompt
sys.exit(0)
```

## n8n Node Configuration

In your Claude Code Streaming node, configure the hooks as follows:

### 1. Basic Setup
- Enable "Claude Code Hooks" → "Enable Hooks": `true`
- Set "Project Path" to your project directory (e.g., `/path/to/your/project`)

### 2. Configure Hook Events

#### PreToolUse Hook
- Tool Pattern: `Bash|Write` 
- Hook Command: `python ./hooks/security-validator.py`
- Description: "Security validation for dangerous operations"

#### PostToolUse Hook
- Tool Pattern: `Write`
- Hook Command: `python ./hooks/auto-formatter.py`
- Description: "Auto-format Python files after writing"

#### UserPromptSubmit Hook
- Hook Command: `python ./hooks/prompt-validator.py`
- Description: "Validate prompts for sensitive content"

### 3. Output Configuration
- Hooks Output Mode: `streaming` (to see hook events in real-time)
- Hook Timeout: `30` seconds

## File Structure

Your project should have this structure:

```
your-project/
├── .claude/
│   └── hooks.json          # Generated automatically by n8n node
├── hooks/
│   ├── security-validator.py
│   ├── auto-formatter.py
│   └── prompt-validator.py
└── your-code-files...
```

## Hooks Configuration File

The n8n node automatically generates a `.claude/hooks.json` file:

```json
{
  "hooks": {
    "PreToolUse": [
      {
        "matcher": "Bash|Write",
        "hooks": [
          {
            "type": "command",
            "command": "python ./hooks/security-validator.py",
            "description": "Security validation for dangerous operations"
          }
        ]
      }
    ],
    "PostToolUse": [
      {
        "matcher": "Write",
        "hooks": [
          {
            "type": "command",
            "command": "python ./hooks/auto-formatter.py",
            "description": "Auto-format Python files after writing"
          }
        ]
      }
    ],
    "UserPromptSubmit": [
      {
        "hooks": [
          {
            "type": "command",
            "command": "python ./hooks/prompt-validator.py",
            "description": "Validate prompts for sensitive content"
          }
        ]
      }
    ]
  }
}
```

## Streaming Output

When hooks are enabled, you'll see additional block messages in the streaming output:

```json
{
  "type": "status",
  "content": "Claude Code hooks configured: PreToolUse, PostToolUse, UserPromptSubmit",
  "timestamp": "2024-01-01T12:00:00.000Z",
  "metadata": {
    "enabledHooks": ["PreToolUse", "PostToolUse", "UserPromptSubmit"],
    "hooksFile": "/path/to/project/.claude/hooks.json"
  }
}
```

```json
{
  "type": "status", 
  "content": "Pre-tool hook triggered for: Bash",
  "timestamp": "2024-01-01T12:00:01.000Z",
  "metadata": {
    "hookType": "PreToolUse",
    "toolName": "Bash",
    "hooksEnabled": true
  }
}
```

## Tips

1. **Hook Scripts**: Make sure your hook scripts are executable (`chmod +x`)
2. **Error Handling**: Use exit code 2 to block operations, exit code 0 to allow
3. **Debugging**: Enable "Debug Mode" in Additional Options to see detailed logs
4. **Security**: Never commit sensitive data in hook scripts
5. **Performance**: Keep hook scripts lightweight for better performance

## Advanced Usage

- Use the **Webhook** output mode to send hook events to external systems
- Combine with **MCP servers** for database logging of hook events
- Use **pattern matching** to target specific tools or file types
- Chain multiple hooks for complex validation workflows