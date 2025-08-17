// Initial Block Kit Message Handler
// Sends the first Block Kit message and stores timestamp for subsequent updates

/**
 * Handles sending the initial Block Kit message when streaming starts
 * Returns the message timestamp for use in subsequent chat.update calls
 */
async function sendInitialBlockKitMessage() {
  const streamingData = $input.all();
  
  if (!streamingData || streamingData.length === 0) {
    console.log('No streaming data received for initial message');
    return [];
  }

  const results = [];
  
  for (const item of streamingData) {
    if (!item.json.streamingMessages || item.json.streamingMessages.length === 0) {
      continue;
    }
    
    const {
      threadId,
      streamingMessages,
      executionId
    } = item.json;
    
    // Get context from the original trigger
    const originalMessage = $('On Message Received').item.json;
    const channel = originalMessage.channel;
    const thread_ts = originalMessage.event_ts;
    const prompt = originalMessage.text || '';
    
    // Get the first streaming message (should be 'start' type)
    const firstMessage = streamingMessages[0];
    
    if (!firstMessage) {
      continue;
    }
    
    // Create initial Block Kit message
    const initialBlockKit = createInitialBlockKitMessage(
      prompt,
      threadId,
      firstMessage,
      executionId
    );
    
    // Prepare the message payload for chat.postMessage
    const messagePayload = {
      channel: channel,
      thread_ts: thread_ts,
      blocks: initialBlockKit.blocks,
      text: `🚀 Starting Claude Code: ${prompt.substring(0, 100)}...`, // Fallback text
      reply_broadcast: false
    };
    
    // Store for subsequent updates - we'll need to call Slack API here
    // For n8n, we'll return the payload and let a Slack node handle the API call
    results.push({
      json: {
        ...messagePayload,
        // Additional metadata for tracking
        streamingMetadata: {
          threadId: threadId,
          executionId: executionId,
          messageIndex: 0,
          totalMessages: streamingMessages.length,
          isInitialMessage: true,
          prompt: prompt
        }
      }
    });
  }
  
  return results;
}

/**
 * Creates the initial Block Kit message structure
 */
function createInitialBlockKitMessage(prompt, threadId, firstMessage, executionId) {
  const blocks = [
    {
      "type": "section",
      "text": {
        "type": "mrkdwn",
        "text": "🚀 *Claude Code Starting...*"
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
    },
    {
      "type": "divider"
    },
    {
      "type": "section",
      "text": {
        "type": "mrkdwn",
        "text": `*Status:*\n${firstMessage.message || '🔄 Initializing...'}`
      }
    },
    {
      "type": "context",
      "elements": [
        {
          "type": "mrkdwn",
          "text": `⏳ Starting execution • ${new Date().toLocaleTimeString()}`
        }
      ]
    }
  ];

  return { "blocks": blocks };
}

// Execute the function
return sendInitialBlockKitMessage();