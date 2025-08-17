// Context Monitor for Persistent Collaborative Chat
// Tracks thread size, manages memory, and triggers auto-compaction

/**
 * Main context monitoring function
 * Checks if compaction is needed and manages thread memory
 */
function monitorContext() {
  const items = $input.all();
  
  if (!items || items.length === 0) {
    return [];
  }

  const results = [];
  
  for (const item of items) {
    const originalMessage = $('On Message Received').item.json;
    const channel = originalMessage.channel;
    const messageText = originalMessage.text || '';
    
    // Create persistent thread ID based on channel
    const persistentThreadId = `collaborative_${channel}`;
    
    // Get current context stats from static data
    const contextStats = getContextStats(persistentThreadId);
    
    // Check if compaction is needed
    const compactionNeeded = shouldTriggerCompaction(contextStats, messageText);
    
    if (compactionNeeded) {
      // Trigger compaction workflow
      results.push({
        json: {
          action: 'trigger_compaction',
          threadId: persistentThreadId,
          channel: channel,
          currentStats: contextStats,
          incomingMessage: messageText,
          compactionReason: getCompactionReason(contextStats),
          timestamp: new Date().toISOString()
        }
      });
    } else {
      // Normal processing - update stats and continue
      const updatedStats = updateContextStats(persistentThreadId, messageText);
      
      results.push({
        json: {
          action: 'normal_processing',
          threadId: persistentThreadId,
          channel: channel,
          prompt: enhancePromptWithMemory(messageText, persistentThreadId),
          contextStats: updatedStats,
          timestamp: new Date().toISOString()
        }
      });
    }
  }
  
  return results;
}

/**
 * Get current context statistics from workflow static data
 */
function getContextStats(threadId) {
  const staticData = $workflow.staticData || {};
  const threadData = staticData[`context_${threadId}`] || {};
  
  return {
    messageCount: threadData.messageCount || 0,
    totalCharacters: threadData.totalCharacters || 0,
    lastCompaction: threadData.lastCompaction || null,
    memorySegments: threadData.memorySegments || [],
    recentMessages: threadData.recentMessages || [],
    createdAt: threadData.createdAt || new Date().toISOString()
  };
}

/**
 * Determine if compaction should be triggered
 */
function shouldTriggerCompaction(contextStats, newMessage) {
  const MAX_MESSAGES = 100;  // Trigger compaction after 100 messages
  const MAX_CHARACTERS = 50000;  // Trigger compaction after 50k characters
  const MIN_TIME_BETWEEN_COMPACTIONS = 30 * 60 * 1000; // 30 minutes minimum
  
  // Check message count threshold
  if (contextStats.messageCount >= MAX_MESSAGES) {
    return true;
  }
  
  // Check character count threshold
  const newMessageLength = newMessage.length;
  if (contextStats.totalCharacters + newMessageLength >= MAX_CHARACTERS) {
    return true;
  }
  
  // Check time since last compaction (avoid too frequent compactions)
  if (contextStats.lastCompaction) {
    const timeSinceLastCompaction = new Date().getTime() - new Date(contextStats.lastCompaction).getTime();
    if (timeSinceLastCompaction < MIN_TIME_BETWEEN_COMPACTIONS && contextStats.messageCount < MAX_MESSAGES * 0.8) {
      return false;
    }
  }
  
  // Check if memory segments are getting too numerous
  if (contextStats.memorySegments.length > 10) {
    return true;
  }
  
  return false;
}

/**
 * Get human-readable reason for compaction
 */
function getCompactionReason(contextStats) {
  const MAX_MESSAGES = 100;
  const MAX_CHARACTERS = 50000;
  
  if (contextStats.messageCount >= MAX_MESSAGES) {
    return `Message limit reached (${contextStats.messageCount}/${MAX_MESSAGES} messages)`;
  }
  
  if (contextStats.totalCharacters >= MAX_CHARACTERS) {
    return `Character limit reached (${Math.round(contextStats.totalCharacters/1000)}k/${Math.round(MAX_CHARACTERS/1000)}k characters)`;
  }
  
  if (contextStats.memorySegments.length > 10) {
    return `Memory segments limit reached (${contextStats.memorySegments.length}/10 segments)`;
  }
  
  return 'Context optimization needed';
}

/**
 * Update context statistics with new message
 */
function updateContextStats(threadId, newMessage) {
  const staticData = $workflow.staticData || {};
  const currentStats = getContextStats(threadId);
  
  // Update stats
  const updatedStats = {
    ...currentStats,
    messageCount: currentStats.messageCount + 1,
    totalCharacters: currentStats.totalCharacters + newMessage.length,
    recentMessages: [...currentStats.recentMessages.slice(-9), {
      text: newMessage.substring(0, 200), // Store first 200 chars
      timestamp: new Date().toISOString(),
      length: newMessage.length
    }].slice(-10), // Keep last 10 messages
    lastUpdated: new Date().toISOString()
  };
  
  // Store updated stats in static data
  staticData[`context_${threadId}`] = updatedStats;
  
  return updatedStats;
}

/**
 * Enhance prompt with relevant memory context
 */
function enhancePromptWithMemory(originalPrompt, threadId) {
  const contextStats = getContextStats(threadId);
  
  if (contextStats.memorySegments.length === 0) {
    return originalPrompt;
  }
  
  // Get most recent memory segments
  const recentMemory = contextStats.memorySegments.slice(-3); // Last 3 segments
  
  const memoryContext = recentMemory.map(segment => 
    `[Memory ${segment.timestamp.substring(0, 10)}]: ${segment.summary}`
  ).join('\\n');
  
  return `Previous conversation context:\\n${memoryContext}\\n\\nCurrent request: ${originalPrompt}`;
}

/**
 * Get context utilization percentage
 */
function getContextUtilization(contextStats) {
  const MAX_MESSAGES = 100;
  const MAX_CHARACTERS = 50000;
  
  const messageUtilization = (contextStats.messageCount / MAX_MESSAGES) * 100;
  const characterUtilization = (contextStats.totalCharacters / MAX_CHARACTERS) * 100;
  
  return Math.max(messageUtilization, characterUtilization);
}

/**
 * Create context status for display
 */
function createContextStatus(contextStats) {
  const utilization = getContextUtilization(contextStats);
  
  let status = 'optimal';
  let icon = '🟢';
  
  if (utilization > 90) {
    status = 'critical';
    icon = '🔴';
  } else if (utilization > 75) {
    status = 'warning';
    icon = '🟡';
  } else if (utilization > 50) {
    status = 'moderate';
    icon = '🟠';
  }
  
  return {
    status,
    icon,
    utilization: Math.round(utilization),
    messageCount: contextStats.messageCount,
    memorySegments: contextStats.memorySegments.length
  };
}

// Execute the main function
return monitorContext();