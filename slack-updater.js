// Slack Update Handler for Real-time Message Updates
// This code should be used in n8n Code nodes to handle Slack chat.update API calls

/**
 * Main Slack update handler
 * Manages initial message posting and subsequent updates
 */
async function handleSlackUpdate() {
  const items = $input.all();
  
  if (!items || items.length === 0) {
    return [];
  }

  const results = [];
  
  // Group updates by thread to handle them efficiently
  const updatesByThread = new Map();
  
  for (const item of items) {
    const { threadId, updateType, messageIndex } = item.json;
    
    if (!updatesByThread.has(threadId)) {
      updatesByThread.set(threadId, []);
    }
    updatesByThread.get(threadId).push(item.json);
  }
  
  // Process updates for each thread
  for (const [threadId, updates] of updatesByThread) {
    // Sort updates by message index to ensure correct order
    updates.sort((a, b) => a.messageIndex - b.messageIndex);
    
    for (const update of updates) {
      const result = await processSlackUpdate(update);
      if (result) {
        results.push({ json: result });
      }
    }
  }
  
  return results;
}

/**
 * Processes a single Slack update
 */
async function processSlackUpdate(updateData) {
  const {
    channel,
    thread_ts,
    blocks,
    text,
    threadId,
    updateType,
    messageIndex,
    totalMessages,
    isLastMessage,
    currentMessage
  } = updateData;
  
  try {
    // Check if we should create initial message or update existing one
    const messageKey = `${threadId}_${channel}_${thread_ts}`;
    
    if (messageIndex === 0 || updateType === 'start') {
      // Create initial message
      return await createInitialSlackMessage(updateData);
    } else {
      // Update existing message
      return await updateExistingSlackMessage(updateData);
    }
    
  } catch (error) {
    console.error('Error processing Slack update:', error);
    return {
      error: error.message,
      updateData: updateData,
      timestamp: new Date().toISOString()
    };
  }
}

/**
 * Creates the initial Slack message
 */
async function createInitialSlackMessage(updateData) {
  const {
    channel,
    thread_ts,
    blocks,
    text,
    threadId
  } = updateData;
  
  // Store the message timestamp for future updates
  // Note: In a real n8n environment, you'd store this in workflow static data
  // For now, we'll include it in the response for tracking
  
  return {
    action: 'post_message',
    method: 'POST',
    channel: channel,
    thread_ts: thread_ts,
    blocks: blocks,
    text: text,
    reply_broadcast: true,
    threadId: threadId,
    messageType: 'initial',
    timestamp: new Date().toISOString()
  };
}

/**
 * Updates an existing Slack message
 */
async function updateExistingSlackMessage(updateData) {
  const {
    channel,
    thread_ts,
    blocks,
    text,
    threadId,
    isLastMessage
  } = updateData;
  
  // For updates, we need the message timestamp of the message we want to update
  // In a real implementation, this would be retrieved from workflow static data
  // For now, we'll use the thread_ts as a reference
  
  return {
    action: 'update_message',
    method: 'POST',
    channel: channel,
    ts: thread_ts, // This should be the timestamp of the message to update
    blocks: blocks,
    text: text,
    threadId: threadId,
    messageType: isLastMessage ? 'final' : 'update',
    timestamp: new Date().toISOString()
  };
}

/**
 * Creates a smart rate-limited update strategy
 */
function createUpdateStrategy(updates) {
  // Group updates by type and apply smart filtering
  const importantUpdates = [];
  const regularUpdates = [];
  
  for (const update of updates) {
    if (update.updateType === 'start' || 
        update.updateType === 'completion' || 
        update.updateType === 'error' ||
        update.updateType === 'tool_use') {
      importantUpdates.push(update);
    } else {
      regularUpdates.push(update);
    }
  }
  
  // Always include important updates
  const finalUpdates = [...importantUpdates];
  
  // Add regular updates with rate limiting
  let lastRegularUpdate = 0;
  for (let i = 0; i < regularUpdates.length; i++) {
    const update = regularUpdates[i];
    const timeSinceLastUpdate = i - lastRegularUpdate;
    
    // Include update if enough messages have passed or if it's the last one
    if (timeSinceLastUpdate >= 3 || i === regularUpdates.length - 1) {
      finalUpdates.push(update);
      lastRegularUpdate = i;
    }
  }
  
  return finalUpdates.sort((a, b) => a.messageIndex - b.messageIndex);
}

/**
 * Error handling for failed Slack updates
 */
function handleSlackError(error, updateData) {
  console.error('Slack update failed:', error);
  
  // Create fallback message
  return {
    action: 'post_message',
    method: 'POST',
    channel: updateData.channel,
    thread_ts: updateData.thread_ts,
    text: `⚠️ Update failed for Claude Code execution (Thread: ${updateData.threadId}). Error: ${error.message}`,
    reply_broadcast: false,
    messageType: 'error_fallback',
    originalError: error.message,
    timestamp: new Date().toISOString()
  };
}

/**
 * Creates webhook payload for Slack API
 */
function createSlackWebhookPayload(updateResult) {
  const payload = {
    channel: updateResult.channel,
    text: updateResult.text
  };
  
  if (updateResult.blocks) {
    payload.blocks = updateResult.blocks;
  }
  
  if (updateResult.thread_ts) {
    payload.thread_ts = updateResult.thread_ts;
  }
  
  if (updateResult.reply_broadcast) {
    payload.reply_broadcast = updateResult.reply_broadcast;
  }
  
  return payload;
}

// Main execution for n8n Code node
return handleSlackUpdate();