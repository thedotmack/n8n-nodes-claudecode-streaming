// Slack Block Kit Templates for Claude Code Streaming

/**
 * Creates the initial "Starting" message with Block Kit formatting
 */
function createInitialMessage(prompt, threadId) {
  return {
    "blocks": [
      {
        "type": "section",
        "text": {
          "type": "mrkdwn",
          "text": "🚀 *Starting Claude Code execution...*"
        }
      },
      {
        "type": "section",
        "fields": [
          {
            "type": "mrkdwn",
            "text": `*Prompt:*\n${prompt.substring(0, 200)}${prompt.length > 200 ? '...' : ''}`
          },
          {
            "type": "mrkdwn",
            "text": `*Thread ID:*\n\`${threadId}\``
          }
        ]
      },
      {
        "type": "context",
        "elements": [
          {
            "type": "mrkdwn",
            "text": "⏳ Initializing..."
          }
        ]
      }
    ]
  };
}

/**
 * Creates an updated message with progress and streaming content
 */
function createProgressMessage(prompt, threadId, streamingMessages, status = 'running') {
  const blocks = [
    {
      "type": "section",
      "text": {
        "type": "mrkdwn",
        "text": status === 'running' ? "⚡ *Claude Code is working...*" : 
               status === 'completed' ? "✅ *Claude Code execution completed*" : 
               "❌ *Claude Code execution failed*"
      }
    },
    {
      "type": "section",
      "fields": [
        {
          "type": "mrkdwn",
          "text": `*Prompt:*\n${prompt.substring(0, 150)}${prompt.length > 150 ? '...' : ''}`
        },
        {
          "type": "mrkdwn",
          "text": `*Thread ID:*\n\`${threadId}\``
        }
      ]
    }
  ];

  // Add progress section if we have streaming messages
  if (streamingMessages && streamingMessages.length > 0) {
    const lastMessage = streamingMessages[streamingMessages.length - 1];
    const toolMessages = streamingMessages.filter(msg => msg.type === 'tool_use');
    const statusMessages = streamingMessages.filter(msg => msg.type === 'start' || msg.type === 'completion' || msg.type === 'error');
    
    blocks.push({
      "type": "divider"
    });

    // Add current status
    blocks.push({
      "type": "section",
      "text": {
        "type": "mrkdwn",
        "text": `*Latest Update:*\n${lastMessage.message}`
      }
    });

    // Add tool usage summary if any tools were used
    if (toolMessages.length > 0) {
      const toolSummary = toolMessages.map(msg => `• ${msg.message}`).join('\n');
      blocks.push({
        "type": "section",
        "text": {
          "type": "mrkdwn",
          "text": `*Tools Used:*\n${toolSummary}`
        }
      });
    }

    // Add context with timing and message count
    blocks.push({
      "type": "context",
      "elements": [
        {
          "type": "mrkdwn",
          "text": `📊 ${streamingMessages.length} updates • Last: ${new Date(lastMessage.timestamp).toLocaleTimeString()}`
        }
      ]
    });
  } else {
    blocks.push({
      "type": "context",
      "elements": [
        {
          "type": "mrkdwn",
          "text": "⏳ Waiting for updates..."
        }
      ]
    });
  }

  return { "blocks": blocks };
}

/**
 * Creates a final result message with Block Kit formatting
 */
function createFinalMessage(prompt, threadId, result, success = true, metrics = {}) {
  const blocks = [
    {
      "type": "section",
      "text": {
        "type": "mrkdwn",
        "text": success ? "✅ *Claude Code execution completed successfully*" : "❌ *Claude Code execution failed*"
      }
    },
    {
      "type": "section",
      "fields": [
        {
          "type": "mrkdwn",
          "text": `*Thread ID:*\n\`${threadId}\``
        },
        {
          "type": "mrkdwn",
          "text": `*Duration:*\n${metrics.duration_ms ? Math.round(metrics.duration_ms / 1000) + 's' : 'Unknown'}`
        }
      ]
    }
  ];

  // Add result section
  if (result) {
    blocks.push({
      "type": "divider"
    });
    
    blocks.push({
      "type": "section",
      "text": {
        "type": "mrkdwn",
        "text": `*Result:*\n${result.substring(0, 2000)}${result.length > 2000 ? '\n\n_[Result truncated - see main output for full details]_' : ''}`
      }
    });
  }

  // Add metrics if available
  if (metrics.total_cost_usd || metrics.num_turns) {
    const metricFields = [];
    if (metrics.total_cost_usd) {
      metricFields.push({
        "type": "mrkdwn",
        "text": `*Cost:*\n$${metrics.total_cost_usd.toFixed(4)}`
      });
    }
    if (metrics.num_turns) {
      metricFields.push({
        "type": "mrkdwn",
        "text": `*Turns:*\n${metrics.num_turns}`
      });
    }
    
    if (metricFields.length > 0) {
      blocks.push({
        "type": "section",
        "fields": metricFields
      });
    }
  }

  return { "blocks": blocks };
}

/**
 * Creates an error message with Block Kit formatting
 */
function createErrorMessage(prompt, threadId, error) {
  return {
    "blocks": [
      {
        "type": "section",
        "text": {
          "type": "mrkdwn",
          "text": "❌ *Claude Code execution failed*"
        }
      },
      {
        "type": "section",
        "fields": [
          {
            "type": "mrkdwn",
            "text": `*Thread ID:*\n\`${threadId}\``
          },
          {
            "type": "mrkdwn",
            "text": `*Time:*\n${new Date().toLocaleTimeString()}`
          }
        ]
      },
      {
        "type": "divider"
      },
      {
        "type": "section",
        "text": {
          "type": "mrkdwn",
          "text": `*Error:*\n\`\`\`\n${error}\n\`\`\``
        }
      }
    ]
  };
}

module.exports = {
  createInitialMessage,
  createProgressMessage,
  createFinalMessage,
  createErrorMessage
};