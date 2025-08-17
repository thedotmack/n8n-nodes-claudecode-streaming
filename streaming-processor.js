// Claude Code Streaming Processor for n8n
// This code should be used in n8n Code nodes to handle real-time streaming

/**
 * Main streaming processor function
 * Processes streaming messages and sends real-time updates to Slack
 */
async function processStreamingMessages() {
  // Get the streaming data from the Claude Code node
  const streamingData = $input.all();
  
  if (!streamingData || streamingData.length === 0) {
    console.log('No streaming data received');
    return [];
  }

  const results = [];
  
  for (const item of streamingData) {
    if (!item.json.streamingMessages) {
      continue;
    }
    
    const {
      threadId,
      streamingMessages,
      messageCount,
      executionId,
      streamingFormat
    } = item.json;
    
    // Get additional context from the original trigger
    const originalMessage = $('On Message Received').item.json;
    const channel = originalMessage.channel;
    const thread_ts = originalMessage.event_ts;
    
    // Process each streaming message individually
    for (let i = 0; i < streamingMessages.length; i++) {
      const streamingMessage = streamingMessages[i];
      const isLastMessage = i === streamingMessages.length - 1;
      
      // Determine if this should trigger an update
      const shouldUpdate = shouldTriggerUpdate(streamingMessage, i, streamingMessages);
      
      if (shouldUpdate) {
        // Create update payload
        const updatePayload = createUpdatePayload(
          streamingMessage,
          streamingMessages.slice(0, i + 1), // All messages up to this point
          threadId,
          originalMessage,
          isLastMessage
        );
        
        results.push({
          json: {
            ...updatePayload,
            messageIndex: i,
            totalMessages: streamingMessages.length,
            isLastMessage,
            executionId,
            updateType: getUpdateType(streamingMessage)
          }
        });
      }
    }
  }
  
  return results;
}

/**
 * Determines if a streaming message should trigger a Slack update
 */
function shouldTriggerUpdate(message, index, allMessages) {
  // Always update on first message
  if (index === 0) return true;
  
  // Always update on last message
  if (index === allMessages.length - 1) return true;
  
  // Update on important message types
  if (message.type === 'start' || message.type === 'completion' || message.type === 'error') {
    return true;
  }
  
  // Update on tool usage
  if (message.type === 'tool_use') {
    return true;
  }
  
  // Update every 5 messages to avoid spam
  if (index % 5 === 0) return true;
  
  // Update if significant time has passed (more than 3 seconds)
  if (index > 0) {
    const currentTime = new Date(message.timestamp).getTime();
    const lastTime = new Date(allMessages[index - 1].timestamp).getTime();
    if (currentTime - lastTime > 3000) return true;
  }
  
  return false;
}

/**
 * Creates the update payload for Slack
 */
function createUpdatePayload(currentMessage, allMessages, threadId, originalMessage, isLastMessage) {
  const channel = originalMessage.channel;
  const thread_ts = originalMessage.event_ts;
  
  // Extract prompt from original message
  const prompt = originalMessage.text || '';
  
  // Determine update type and status
  const updateType = getUpdateType(currentMessage);
  const status = isLastMessage ? 'completed' : 'running';
  
  // Create Block Kit message using our templates
  const blockKitMessage = createProgressBlockKit(
    prompt,
    threadId,
    allMessages,
    status,
    currentMessage
  );
  
  return {
    channel: channel,
    thread_ts: thread_ts,
    blocks: blockKitMessage.blocks,
    text: `Claude Code ${status}: ${currentMessage.message}`, // Fallback text
    currentMessage: currentMessage,
    allStreamingMessages: allMessages,
    threadId: threadId,
    updateType: updateType,
    timestamp: new Date().toISOString()
  };
}

/**
 * Gets the update type based on message content
 */
function getUpdateType(message) {
  if (message.type === 'start') return 'start';
  if (message.type === 'completion') return 'completion';
  if (message.type === 'error') return 'error';
  if (message.type === 'tool_use') return 'tool_use';
  return 'progress';
}

/**
 * Creates Block Kit formatted message for progress updates
 */
function createProgressBlockKit(prompt, threadId, streamingMessages, status, currentMessage) {
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

  // Add current status
  if (currentMessage) {
    blocks.push({
      "type": "divider"
    });

    blocks.push({
      "type": "section",
      "text": {
        "type": "mrkdwn",
        "text": `*Latest Update:*\n${currentMessage.message}`
      }
    });
  }

  // Add tool usage summary
  const toolMessages = streamingMessages.filter(msg => msg.type === 'tool_use');
  if (toolMessages.length > 0) {
    const recentTools = toolMessages.slice(-3); // Show last 3 tools
    const toolSummary = recentTools.map(msg => `• ${msg.message}`).join('\n');
    
    blocks.push({
      "type": "section",
      "text": {
        "type": "mrkdwn",
        "text": `*Recent Tools:*\n${toolSummary}${toolMessages.length > 3 ? `\n_...and ${toolMessages.length - 3} more_` : ''}`
      }
    });
  }

  // Add progress context
  const progressText = status === 'completed' ? 
    `✅ Completed with ${streamingMessages.length} updates` :
    `⏳ ${streamingMessages.length} updates • ${getTimeElapsed(streamingMessages)}`;

  blocks.push({
    "type": "context",
    "elements": [
      {
        "type": "mrkdwn",
        "text": progressText
      }
    ]
  });

  return { "blocks": blocks };
}

/**
 * Calculates time elapsed from first to last message
 */
function getTimeElapsed(messages) {
  if (messages.length < 2) return 'Just started';
  
  const firstTime = new Date(messages[0].timestamp).getTime();
  const lastTime = new Date(messages[messages.length - 1].timestamp).getTime();
  const elapsed = Math.round((lastTime - firstTime) / 1000);
  
  if (elapsed < 60) {
    return `${elapsed}s elapsed`;
  } else {
    const minutes = Math.floor(elapsed / 60);
    const seconds = elapsed % 60;
    return `${minutes}m ${seconds}s elapsed`;
  }
}

/**
 * Rate limiting helper - prevents too many rapid updates
 */
const updateTimestamps = new Map();

function shouldRateLimit(threadId, minInterval = 2000) {
  const now = Date.now();
  const lastUpdate = updateTimestamps.get(threadId) || 0;
  
  if (now - lastUpdate < minInterval) {
    return true; // Rate limited
  }
  
  updateTimestamps.set(threadId, now);
  return false; // Not rate limited
}

// Main execution for n8n Code node
return processStreamingMessages();