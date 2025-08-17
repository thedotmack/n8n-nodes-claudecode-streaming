// Real-time Block Kit Updater
// Uses Slack's chat.update API to update existing messages with Block Kit formatting

/**
 * Updates existing Slack messages with real-time Block Kit content
 * Uses chat.update API to modify messages in place
 */
function updateBlockKitMessage() {
  const streamingData = $input.all();
  
  if (!streamingData || streamingData.length === 0) {
    console.log('No streaming data received for Block Kit update');
    return [];
  }

  const results = [];
  
  for (const item of streamingData) {
    const {
      channel,
      thread_ts,
      currentMessage,
      allStreamingMessages,
      threadId,
      updateType,
      messageIndex,
      totalMessages,
      isLastMessage,
      routeTo,
      priority
    } = item.json;
    
    if (!currentMessage || !allStreamingMessages) {
      continue;
    }
    
    // Get the original prompt from the trigger
    const originalMessage = $('On Message Received').item.json;
    const prompt = originalMessage.text || '';
    
    // Create the appropriate Block Kit message based on update type and route
    const blockKitMessage = createBlockKitUpdateMessage(
      prompt,
      threadId,
      currentMessage,
      allStreamingMessages,
      updateType,
      isLastMessage,
      routeTo
    );
    
    // Prepare chat.update payload
    const updatePayload = {
      // For n8n Slack node, we need these specific fields
      resource: 'message',
      operation: 'update',
      channel: channel,
      ts: thread_ts, // This should be the timestamp of the message to update
      blocks: blockKitMessage.blocks,
      text: createFallbackText(currentMessage, isLastMessage), // Fallback for notifications
      
      // Additional metadata for tracking
      streamingMetadata: {
        threadId: threadId,
        updateType: updateType,
        messageIndex: messageIndex,
        totalMessages: totalMessages,
        isLastMessage: isLastMessage,
        routeTo: routeTo,
        priority: priority,
        timestamp: new Date().toISOString()
      }
    };
    
    results.push({
      json: updatePayload
    });
  }
  
  return results;
}

/**
 * Creates Block Kit message structure for updates
 */
function createBlockKitUpdateMessage(prompt, threadId, currentMessage, allMessages, updateType, isLastMessage, routeTo) {
  const status = determineStatus(updateType, isLastMessage);
  const statusIcon = getStatusIcon(status);
  const statusText = getStatusText(status);
  
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
          "text": `*Request:*\n${prompt.substring(0, 200)}${prompt.length > 200 ? '...' : ''}`
        },
        {
          "type": "mrkdwn",
          "text": `*Thread ID:*\n\`${threadId}\``
        }
      ]
    }
  ];

  // Add divider
  blocks.push({"type": "divider"});

  // Add current status/message
  blocks.push({
    "type": "section",
    "text": {
      "type": "mrkdwn",
      "text": `*Latest Update:*\n${currentMessage.message}`
    }
  });

  // Add tool usage if present
  const toolMessages = allMessages.filter(msg => 
    msg.type === 'tool_use' || 
    msg.message.includes('🔧') || 
    msg.message.includes('📁') ||
    msg.message.includes('🔍') ||
    msg.message.includes('✏️')
  );
  
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
  const progressText = createProgressText(allMessages, isLastMessage);
  blocks.push({
    "type": "context",
    "elements": [
      {
        "type": "mrkdwn",
        "text": progressText
      }
    ]
  });

  // Add action buttons for completed messages
  if (isLastMessage && status === 'completed') {
    blocks.push({
      "type": "actions",
      "elements": [
        {
          "type": "button",
          "text": {
            "type": "plain_text",
            "text": "Continue Chat"
          },
          "style": "primary",
          "action_id": "continue_chat_" + threadId
        },
        {
          "type": "button",
          "text": {
            "type": "plain_text",
            "text": "View Details"
          },
          "action_id": "view_details_" + threadId
        }
      ]
    });
  }

  return { "blocks": blocks };
}

/**
 * Helper functions
 */
function determineStatus(updateType, isLastMessage) {
  if (isLastMessage) {
    return updateType === 'error' ? 'error' : 'completed';
  }
  return 'running';
}

function getStatusIcon(status) {
  switch (status) {
    case 'running': return '⚡';
    case 'completed': return '✅';
    case 'error': return '❌';
    default: return '🔄';
  }
}

function getStatusText(status) {
  switch (status) {
    case 'running': return 'Claude Code is working...';
    case 'completed': return 'Claude Code execution completed';
    case 'error': return 'Claude Code execution failed';
    default: return 'Claude Code processing...';
  }
}

function createProgressText(allMessages, isLastMessage) {
  if (isLastMessage) {
    const duration = calculateDuration(allMessages);
    return `✅ Completed with ${allMessages.length} updates${duration ? ` in ${duration}` : ''}`;
  } else {
    const elapsed = getTimeElapsed(allMessages);
    return `⏳ ${allMessages.length} updates • ${elapsed}`;
  }
}

function calculateDuration(messages) {
  if (messages.length < 2) return null;
  
  const firstTime = new Date(messages[0].timestamp).getTime();
  const lastTime = new Date(messages[messages.length - 1].timestamp).getTime();
  const duration = Math.round((lastTime - firstTime) / 1000);
  
  if (duration < 60) {
    return `${duration}s`;
  } else {
    const minutes = Math.floor(duration / 60);
    const seconds = duration % 60;
    return `${minutes}m ${seconds}s`;
  }
}

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

function createFallbackText(currentMessage, isLastMessage) {
  const prefix = isLastMessage ? '✅ Claude Code completed:' : '⚡ Claude Code update:';
  return `${prefix} ${currentMessage.message}`;
}

// Execute the function
return updateBlockKitMessage();