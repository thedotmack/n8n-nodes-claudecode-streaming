#!/usr/bin/env python3
"""
Security Validator Hook (PreToolUse)
Validates tool usage before execution to prevent dangerous operations.
"""
import json
import sys

def main():
    try:
        # Load hook input from stdin
        input_data = json.load(sys.stdin)
        
        tool_name = input_data.get("tool_name", "")
        tool_input = input_data.get("tool_input", {})
        
        # Block dangerous bash operations
        if tool_name == "Bash":
            command = tool_input.get("command", "")
            dangerous_commands = ["rm -rf", "sudo", "format", "fdisk", "mkfs"]
            
            if any(cmd in command.lower() for cmd in dangerous_commands):
                # Exit with code 2 to block the operation
                print("Security violation: Dangerous command blocked", file=sys.stderr)
                sys.exit(2)
        
        # Block writes to sensitive files
        if tool_name == "Write":
            file_path = tool_input.get("file_path", "")
            sensitive_files = [".env", "secrets", "id_rsa", "config.json"]
            
            if any(sensitive in file_path.lower() for sensitive in sensitive_files):
                print("Security violation: Cannot write to sensitive files", file=sys.stderr)
                sys.exit(2)
        
        # Allow the operation
        print("Security check passed")
        sys.exit(0)
        
    except Exception as e:
        print(f"Hook error: {e}", file=sys.stderr)
        sys.exit(1)

if __name__ == "__main__":
    main()