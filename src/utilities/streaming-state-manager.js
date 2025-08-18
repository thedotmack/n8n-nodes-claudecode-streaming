// Streaming State Manager
// Manages message timestamps and state across streaming updates

/**
 * Manages the state of streaming messages, including message timestamps
 * for proper chat.update API usage
 */
function manageStreamingState() {
  const items = $input.all();
  
  if (!items || items.length === 0) {
    console.log('No items received for state management');
    return [];
  }

  const results = [];
  
  for (const item of items) {
    const itemData = item.json;
    
    // Check if this is an initial message response (from Slack API)
    if (itemData.ts && itemData.channel && itemData.streamingMetadata?.isInitialMessage) {
      // This is the response from the initial message - store the timestamp
      const messageTimestamp = itemData.ts;
      const metadata = itemData.streamingMetadata;
      
      // Store the message timestamp for future updates
      const stateUpdate = {
        json: {
          action: 'store_initial_timestamp',
          threadId: metadata.threadId,
          executionId: metadata.executionId,
          messageTimestamp: messageTimestamp,
          channel: itemData.channel,
          thread_ts: itemData.message?.thread_ts || null,
          prompt: metadata.prompt,
          timestamp: new Date().toISOString()
        }
      };
      
      results.push(stateUpdate);
    }
    
    // Check if this is a streaming update that needs timestamp injection
    else if (itemData.streamingMetadata && !itemData.messageTimestamp) {
      // This is a streaming update that needs the stored timestamp
      const metadata = itemData.streamingMetadata;
      
      // In a real implementation, we'd retrieve from workflow static data
      // For now, we'll use the thread_ts as the message timestamp
      // This assumes the initial message was sent to the thread
      
      const enhancedUpdate = {
        json: {
          ...itemData,
          action: 'update_message',
          messageTimestamp: itemData.thread_ts, // Use thread_ts as message timestamp
          streamingState: {
            hasTimestamp: true,
            canUpdate: true,
            threadId: metadata.threadId,
            updateType: metadata.updateType
          }
        }
      };
      
      results.push(enhancedUpdate);
    }
    
    // Pass through other items unchanged
    else {
      results.push(item);
    }
  }
  
  return results;
}

/**
 * Alternative approach: Extract and inject message timestamp for updates
 * This version focuses on ensuring chat.update has the correct timestamp
 */
function injectMessageTimestamp() {
  const items = $input.all();
  
  if (!items || items.length === 0) {
    return [];
  }

  const results = [];
  
  // Get the original message context
  const originalMessage = $('On Message Received').item.json;
  const baseThreadTs = originalMessage.event_ts;
  
  for (const item of items) {
    const itemData = item.json;
    
    // If this is a streaming update, ensure it has the correct message timestamp
    if (itemData.blocks && itemData.channel) {
      // This looks like a Block Kit update
      const updatedItem = {
        json: {
          ...itemData,
          ts: itemData.ts || baseThreadTs, // Ensure we have a timestamp for chat.update
          // Add additional context for the Slack node
          slackAction: 'update_message',
          originalThreadTs: baseThreadTs,
          updateType: itemData.streamingMetadata?.updateType || 'progress'
        }
      };
      
      results.push(updatedItem);
    } else {
      // Pass through non-update items
      results.push(item);
    }
  }
  
  return results;
}

/**
 * State validator - ensures we have all required data for updates
 */
function validateUpdateState() {
  const items = $input.all();
  const results = [];
  
  for (const item of items) {
    const itemData = item.json;
    
    // Validate required fields for chat.update
    const hasChannel = itemData.channel;
    const hasTimestamp = itemData.ts || itemData.thread_ts;
    const hasBlocks = itemData.blocks && Array.isArray(itemData.blocks);
    
    if (hasChannel && hasTimestamp && hasBlocks) {
      // Valid update - add validation metadata
      results.push({
        json: {
          ...itemData,
          validationState: {
            isValid: true,
            hasAllRequiredFields: true,
            canProceedWithUpdate: true,
            timestamp: new Date().toISOString()
          }
        }
      });
    } else {
      // Invalid update - log what's missing
      const missingFields = [];
      if (!hasChannel) missingFields.push('channel');
      if (!hasTimestamp) missingFields.push('timestamp');
      if (!hasBlocks) missingFields.push('blocks');
      
      results.push({
        json: {
          ...itemData,
          validationState: {
            isValid: false,
            missingFields: missingFields,
            canProceedWithUpdate: false,
            error: `Missing required fields for chat.update: ${missingFields.join(', ')}`
          }
        }
      });
    }
  }
  
  return results;
}

/**
 * Message timestamp tracker for workflow static data storage
 */
function trackMessageTimestamps() {
  const items = $input.all();
  const results = [];
  
  for (const item of items) {
    const itemData = item.json;
    
    // If this is a new message response from Slack
    if (itemData.ts && itemData.ok && itemData.message) {
      const threadId = itemData.streamingMetadata?.threadId;
      
      if (threadId) {
        // Create a tracking record
        const trackingRecord = {
          json: {
            action: 'track_message',
            threadId: threadId,
            messageTimestamp: itemData.ts,
            channel: itemData.channel,
            createdAt: new Date().toISOString(),
            // Store this in workflow static data key
            staticDataKey: `streaming_message_${threadId}`,
            staticDataValue: {
              ts: itemData.ts,
              channel: itemData.channel,
              threadId: threadId
            }
          }
        };
        
        results.push(trackingRecord);
      }
    }
    
    // Pass through the original item too
    results.push(item);
  }
  
  return results;
}

// Main execution - use injectMessageTimestamp for simplicity
return injectMessageTimestamp();