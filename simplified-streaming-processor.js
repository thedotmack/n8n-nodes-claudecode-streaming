// Simplified Streaming Processor for Persistent Chat
// Handles both initial message posting and updates

async function processSimplifiedStreaming() {
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
      executionId
    } = item.json;
    
    // Get original message context
    const originalMessage = $('On Message Received').item.json;
    const channel = 'C09ANU1Q0QZ';
    const event_ts = originalMessage.event_ts;
    const prompt = originalMessage.text || '';
    
    // Track if we've posted initial message for this execution
    let hasPostedInitial = false;
    
    // Process streaming messages for persistent collaborative chat
    for (let i = 0; i < streamingMessages.length; i++) {
      const streamingMessage = streamingMessages[i];
      const isLastMessage = i === streamingMessages.length - 1;
      const isFirstUpdate = i === 0;
      
      // Smart filtering for persistent chat (less frequent updates)
      if (shouldCreateCollaborativeUpdate(streamingMessage, i, streamingMessages)) {
        const blockKitPayload = createCollaborativeBlockKit(
          streamingMessage,
          streamingMessages.slice(0, i + 1),
          threadId,
          originalMessage,
          isLastMessage,
          isFirstUpdate && !hasPostedInitial
        );
        
        // Determine if this is a post or update
        const isPost = isFirstUpdate && !hasPostedInitial;
        hasPostedInitial = true;
        
        results.push({
          json: {
            ...blockKitPayload,
            messageIndex: i,
            totalMessages: streamingMessages.length,
            isLastMessage,
            executionId,
            updateType: getUpdateType(streamingMessage),
            isPersistentChat: true,
            slackOperation: isPost ? 'post' : 'update'
          }
        });
      }
    }
  }
  
  return results;
}

/**
 * Smart filtering for collaborative chat (reduce noise)
 */
function shouldCreateCollaborativeUpdate(message, index, allMessages) {
  // Always update on first and last messages
  if (index === 0 || index === allMessages.length - 1) return true;
  
  // Update on important events
  if (message.type === 'tool_use' || message.type === 'error') return true;
  
  // Less frequent updates for collaborative chat (every 8 messages instead of 5)
  if (index % 8 === 0) return true;
  
  // Update if significant time gap (5+ seconds instead of 3)
  if (index > 0) {
    const currentTime = new Date(message.timestamp).getTime();
    const lastTime = new Date(allMessages[index - 1].timestamp).getTime();
    if (currentTime - lastTime > 5000) return true;
  }
  
  return false;
}

/**
 * Create Block Kit for collaborative persistent chat
 */
function createCollaborativeBlockKit(currentMessage, allMessages, threadId, originalMessage, isLastMessage, isInitialPost) {
  const channel = 'C09ANU1Q0QZ';
  const event_ts = originalMessage.event_ts;
  const prompt = originalMessage.text || '';
  
  const status = isLastMessage ? 'completed' : 'working';
  const statusIcon = isLastMessage ? '✅' : '⚡';
  const statusText = isLastMessage ? 'Response completed' : 'Claude Code working...';
  
  const blocks = [
    {
      "type": "section",
      "text": {
        "type": "mrkdwn",
        "text": `${statusIcon} *${statusText}*`
      }
    },
    {
      "type": "section",
      "fields": [
        {
          "type": "mrkdwn",
          "text": `*Request:*\\n${prompt.substring(0, 150)}${prompt.length > 150 ? '...' : ''}`
        },
        {
          "type": "mrkdwn",
          "text": `*Chat Type:*\\nPersistent Collaborative`
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
        "text": `*Status:*\\n${currentMessage.message}`
      }
    }
  ];

  // Add tool usage if present
  const toolMessages = allMessages.filter(msg => msg.type === 'tool_use');
  if (toolMessages.length > 0) {
    const recentTools = toolMessages.slice(-2);
    const toolSummary = recentTools.map(msg => `• ${msg.message}`).join('\\n');
    
    blocks.push({
      "type": "section",
      "text": {
        "type": "mrkdwn",
        "text": `*Tools Used:*\\n${toolSummary}${toolMessages.length > 2 ? `\\n_...and ${toolMessages.length - 2} more_` : ''}`
      }
    });
  }

  // Add progress context
  const progressText = isLastMessage ? 
    `✅ Collaborative response completed (${allMessages.length} updates)` :
    `⚡ ${allMessages.length} updates • Collaborating...`;

  blocks.push({
    "type": "context",
    "elements": [
      {
        "type": "mrkdwn",
        "text": progressText
      }
    ]
  });

  return {
    channel: channel,
    thread_ts: event_ts,
    messageType: isInitialPost ? 'initial' : 'update',
    blocks: JSON.stringify(blocks),
    text: `${statusIcon} ${statusText}: ${currentMessage.message}`,
    currentMessage: currentMessage,
    allStreamingMessages: allMessages,
    threadId: threadId,
    timestamp: new Date().toISOString()
  };
}

function getUpdateType(message) {
  if (message.type === 'start') return 'start';
  if (message.type === 'completion') return 'completion';
  if (message.type === 'error') return 'error';
  if (message.type === 'tool_use') return 'tool_use';
  return 'progress';
}

// Execute the main function
return processSimplifiedStreaming();