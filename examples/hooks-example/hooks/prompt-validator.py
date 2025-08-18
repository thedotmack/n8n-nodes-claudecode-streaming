#!/usr/bin/env python3
"""
Prompt Validator Hook (UserPromptSubmit)
Validates user prompts before they are processed to prevent sensitive data exposure.
"""
import json
import sys
import re

def main():
    try:
        # Load hook input from stdin
        input_data = json.load(sys.stdin)
        
        prompt = input_data.get("prompt", "")
        
        # Check for sensitive patterns
        sensitive_patterns = [
            (r"(?i)\b(password|secret|key|token)\s*[:=]", "Password/Secret detected"),
            (r"(?i)delete\s+all", "Dangerous delete operation"),
            (r"(?i)drop\s+table", "Dangerous SQL operation"),
            (r"\b\d{4}[-\s]?\d{4}[-\s]?\d{4}[-\s]?\d{4}\b", "Credit card number pattern"),
# examples/hooks-example/hooks/prompt-validator.py (around line 23)
            (r"\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b", "Email address"),
        ]
        
        for pattern, description in sensitive_patterns:
            if re.search(pattern, prompt):
                # Block the prompt
                output = {
                    "decision": "block",
                    "reason": f"Prompt contains potentially sensitive information: {description}"
                }
                print(json.dumps(output))
                sys.exit(0)
        
        # Check prompt length
        if len(prompt) > 10000:
            output = {
                "decision": "block", 
                "reason": "Prompt is too long (>10000 characters)"
            }
            print(json.dumps(output))
            sys.exit(0)
        
        # Add context if needed
        if len(prompt) < 10:
            output = {
                "hookSpecificOutput": {
                    "hookEventName": "UserPromptSubmit",
                    "additionalContext": "Note: This is a very short prompt. Consider providing more context for better results."
                }
            }
            print(json.dumps(output))
        
        # Allow the prompt
        sys.exit(0)
        
    except Exception as e:
        print(f"Hook error: {e}", file=sys.stderr)
        sys.exit(1)

if __name__ == "__main__":
    main()