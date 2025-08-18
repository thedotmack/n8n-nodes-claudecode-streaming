#!/usr/bin/env python3
"""
Stop Hook Example
Controls when Claude Code is allowed to stop execution.
"""
import json
import sys

def main():
    try:
        # Load hook input from stdin
        input_data = json.load(sys.stdin)
        
        stop_hook_active = input_data.get("stop_hook_active", False)
        
        # If another stop hook is already active, allow stopping
        if stop_hook_active:
            # Allow stopping without any special output
            sys.exit(0)
        
        # For demonstration, we could block stopping under certain conditions
        # For example, if there are incomplete tasks
        
        # In this example, we'll allow stopping but provide feedback
        print("Claude Code execution completed successfully")
        sys.exit(0)
        
    except Exception as e:
        print(f"Hook error: {e}", file=sys.stderr)
        sys.exit(1)

if __name__ == "__main__":
    main()