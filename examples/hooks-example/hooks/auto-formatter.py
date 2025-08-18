#!/usr/bin/env python3
"""
Auto-formatter Hook (PostToolUse)
Automatically formats code files after they are written.
"""
import json
import sys
import subprocess

def main():
    try:
        # Load hook input from stdin
        input_data = json.load(sys.stdin)
        
        tool_name = input_data.get("tool_name", "")
        tool_input = input_data.get("tool_input", {})
        
        # Auto-format Python files after writing
        if tool_name == "Write":
            file_path = tool_input.get("file_path", "")
            
            if file_path.endswith(".py"):
                try:
                    # Try to format with black
                    result = subprocess.run(["black", file_path], 
                                          capture_output=True, 
                                          text=True, 
                                          timeout=10)
                    if result.returncode == 0:
                        print(f"✅ Auto-formatted: {file_path}")
                    else:
                        print(f"⚠️ Failed to format: {file_path}")
                except (subprocess.TimeoutExpired, FileNotFoundError):
                    print(f"⚠️ Black formatter not available for: {file_path}")
            
            elif file_path.endswith((".js", ".ts")):
                try:
                    # Try to format with prettier
                    result = subprocess.run(["prettier", "--write", file_path], 
                                          capture_output=True, 
                                          text=True, 
                                          timeout=10)
                    if result.returncode == 0:
                        print(f"✅ Auto-formatted: {file_path}")
                    else:
                        print(f"⚠️ Failed to format: {file_path}")
                except (subprocess.TimeoutExpired, FileNotFoundError):
                    print(f"⚠️ Prettier formatter not available for: {file_path}")
        
        sys.exit(0)
        
    except Exception as e:
        print(f"Hook error: {e}", file=sys.stderr)
        sys.exit(1)

if __name__ == "__main__":
    main()