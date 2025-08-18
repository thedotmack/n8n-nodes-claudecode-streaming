// Simplified Block Message Processor for Real-Time Streaming
// Processes individual BlockMessage objects from the streaming output

async function processBlockMessageStreaming() {
  const blockMessages = $input.all();
  
  if (!blockMessages || blockMessages.length === 0) {
    console.log('No block messages received');
    return [];
  }

  const results = [];
  
  // Process each block message individually for real-time updates
  for (const item of blockMessages) {
    // Extract BlockMessage data from our simplified streaming node
    const blockMessage = item.json;
    
    // Validate this is a BlockMessage
    if (!blockMessage.type || !blockMessage.content || !blockMessage.timestamp) {
      console.log('Invalid block message format, skipping:', blockMessage);
      continue;
    }
    
    // Get original message context (if available)
    const originalMessage = $('On Message Received')?.item?.json || {};
    const channel = 'C09ANU1Q0QZ';
    const event_ts = originalMessage.event_ts || new Date().toISOString();
    const prompt = originalMessage.text || 'Claude Code Request';
    
    // Determine if this should trigger a Slack update
    if (shouldCreateSlackUpdate(blockMessage)) {
      const slackPayload = createSlackBlockKit(
        blockMessage,
        originalMessage,
        event_ts,
        prompt
      );
      
      results.push({
        json: {
          ...slackPayload,
          blockMessageType: blockMessage.type,
          originalBlockMessage: blockMessage,
          timestamp: blockMessage.timestamp,
          isRealTimeUpdate: true
        }
      });
    }
  }
  
  return results;
}

/**
 * Determine if BlockMessage should trigger Slack update
 */
function shouldCreateSlackUpdate(blockMessage) {
  // Always update on important events
  if (blockMessage.type === 'tool_use' || blockMessage.type === 'error' || blockMessage.type === 'status') {
    return true;
  }
  
  // Update for text blocks if they contain significant content
  if (blockMessage.type === 'text' && blockMessage.content.length > 50) {
    return true;
  }
  
  // Skip very short text updates to reduce noise
  return false;
}

/**
 * Create Slack Block Kit for individual BlockMessage
 */
function createSlackBlockKit(blockMessage, originalMessage, event_ts, prompt) {
  const channel = 'C09ANU1Q0QZ';
  
  // Determine status based on block message type
  const statusInfo = getStatusInfo(blockMessage);
  
  const blocks = [
    {
      "type": "section",
      "text": {
        "type": "mrkdwn",
        "text": `${statusInfo.icon} *${statusInfo.text}*`
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
          "text": `*Type:*\\nReal-time Block Streaming`
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
        "text": `*${blockMessage.type.toUpperCase()}:*\\n${blockMessage.content.substring(0, 500)}${blockMessage.content.length > 500 ? '...' : ''}`
      }
    }
  ];

  // Add metadata if present
  if (blockMessage.metadata && Object.keys(blockMessage.metadata).length > 0) {
    const metadataText = Object.entries(blockMessage.metadata)
      .map(([key, value]) => `*${key}:* ${value}`)
      .join('\\n');
    
    blocks.push({
      "type": "section",
      "text": {
        "type": "mrkdwn",
        "text": `*Details:*\\n${metadataText}`
      }
    });
  }

  // Add timestamp context
  blocks.push({
    "type": "context",
    "elements": [
      {
        "type": "mrkdwn",
        "text": `🕒 ${blockMessage.timestamp} • Block: ${blockMessage.type}`
      }
    ]
  });

  return {
    channel: channel,
    thread_ts: event_ts,
    messageType: 'update',
    blocks: JSON.stringify(blocks),
    text: `${statusInfo.icon} ${statusInfo.text}: ${blockMessage.content.substring(0, 100)}`,
    blockMessage: blockMessage,
    timestamp: blockMessage.timestamp
  };
}

/**
 * Get status information for BlockMessage type
 */
function getStatusInfo(blockMessage) {
  switch (blockMessage.type) {
    case 'text':
      return { icon: '💬', text: 'Claude Response' };
    case 'tool_use':
      return { icon: '🔧', text: 'Using Tool' };
    case 'status':
      return { icon: '✅', text: 'Status Update' };
    case 'error':
      return { icon: '❌', text: 'Error' };
    case 'code':
      return { icon: '💻', text: 'Code Output' };
    default:
      return { icon: '⚡', text: 'Claude Working' };
  }
}

// Execute the main function
return processBlockMessageStreaming();