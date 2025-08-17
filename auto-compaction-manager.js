// Auto-Compaction Manager for Persistent Collaborative Chat
// Coordinates the compaction process using Claude Code for summarization

/**
 * Main auto-compaction coordinator
 * Manages the compaction process and Claude Code summarization
 */
function manageAutoCompaction() {
  const items = $input.all();
  
  if (!items || items.length === 0) {
    return [];
  }

  const results = [];
  
  for (const item of items) {
    const { action, threadId, channel, currentStats, incomingMessage, compactionReason } = item.json;
    
    if (action === 'trigger_compaction') {
      // Start compaction process
      const compactionPlan = createCompactionPlan(currentStats, threadId);
      
      // Create status update for compaction start
      const startStatusPayload = createCompactionStatusUpdate('starting', compactionPlan, channel);
      
      results.push({
        json: {
          ...startStatusPayload,
          compactionAction: 'send_status',
          compactionStage: 'starting'
        }
      });
      
      // Create summarization request for Claude Code
      const summarizationRequest = createSummarizationRequest(currentStats, threadId, incomingMessage);
      
      results.push({
        json: {
          ...summarizationRequest,
          compactionAction: 'summarize',
          compactionStage: 'summarizing',
          originalMessage: incomingMessage
        }
      });
      
    } else if (action === 'compaction_complete') {
      // Handle completed compaction
      const completionPayload = handleCompactionCompletion(item.json);
      
      results.push({
        json: {
          ...completionPayload,
          compactionAction: 'send_status',
          compactionStage: 'completed'
        }
      });
      
      // Resume normal processing with the original message
      results.push({
        json: {
          action: 'resume_normal',
          threadId: item.json.threadId,
          channel: item.json.channel,
          prompt: item.json.originalMessage,
          compactionComplete: true
        }
      });
    }
  }
  
  return results;
}

/**
 * Create a compaction plan based on current context stats
 */
function createCompactionPlan(contextStats, threadId) {
  const totalMessages = contextStats.messageCount;
  const totalCharacters = contextStats.totalCharacters;
  const existingSegments = contextStats.memorySegments.length;
  
  // Determine how much to keep vs summarize
  const KEEP_RECENT_MESSAGES = 20; // Keep last 20 messages intact
  const messagesToSummarize = Math.max(0, totalMessages - KEEP_RECENT_MESSAGES);
  
  const plan = {
    threadId: threadId,
    totalMessages: totalMessages,
    messagesToSummarize: messagesToSummarize,
    messagesToKeep: Math.min(totalMessages, KEEP_RECENT_MESSAGES),
    existingMemorySegments: existingSegments,
    estimatedNewSegments: Math.ceil(messagesToSummarize / 30), // Group every 30 messages
    targetReduction: calculateTargetReduction(totalCharacters),
    compactionType: determineCompactionType(contextStats),
    timestamp: new Date().toISOString()
  };
  
  return plan;
}

/**
 * Determine the type of compaction needed
 */
function determineCompactionType(contextStats) {
  if (contextStats.memorySegments.length > 8) {
    return 'memory_consolidation'; // Consolidate existing memory segments
  } else if (contextStats.messageCount > 80) {
    return 'message_summarization'; // Summarize older messages
  } else {
    return 'context_optimization'; // General optimization
  }
}

/**
 * Calculate target character reduction percentage
 */
function calculateTargetReduction(totalCharacters) {
  if (totalCharacters > 40000) {
    return 70; // Reduce by 70%
  } else if (totalCharacters > 30000) {
    return 60; // Reduce by 60%
  } else {
    return 50; // Reduce by 50%
  }
}

/**
 * Create summarization request for Claude Code
 */
function createSummarizationRequest(contextStats, threadId, incomingMessage) {
  const recentMessages = contextStats.recentMessages.slice(-10); // Last 10 messages
  const existingMemory = contextStats.memorySegments.map(seg => 
    `[${seg.timestamp.substring(0, 16)}] ${seg.summary}`
  ).join('\\n');
  
  const summarizationPrompt = createSummarizationPrompt(contextStats, existingMemory, recentMessages);
  
  return {
    threadId: `compaction_${threadId}_${Date.now()}`, // Temporary thread for summarization
    prompt: summarizationPrompt,
    maxTurns: 1,
    timeout: 30000,
    projectPath: "/home/node/docs-empire-markets",
    allowedTools: [],
    streamingOptions: {
      enableStreamingOutput: false // No streaming for summarization
    },
    compactionContext: {
      originalThreadId: threadId,
      contextStats: contextStats,
      incomingMessage: incomingMessage
    }
  };
}

/**
 * Create the prompt for Claude Code to summarize the conversation
 */
function createSummarizationPrompt(contextStats, existingMemory, recentMessages) {
  const prompt = `You are helping to compact a long collaborative conversation between humans and Claude Code. Your task is to create a concise but comprehensive summary.

## Context to Summarize:
- Total messages in thread: ${contextStats.messageCount}
- Total characters: ${contextStats.totalCharacters.toLocaleString()}
- Time span: ${contextStats.createdAt ? `since ${contextStats.createdAt.substring(0, 10)}` : 'recent period'}

## Existing Memory Segments:
${existingMemory || 'None yet'}

## Recent Message Sample:
${recentMessages.map((msg, i) => `${i + 1}. [${msg.timestamp.substring(11, 16)}] ${msg.text.substring(0, 100)}...`).join('\\n')}

## Instructions:
Create a structured summary that preserves:
1. **Key Topics & Decisions**: Main subjects discussed and decisions made
2. **Technical Context**: Important code, configurations, or technical details
3. **Ongoing Projects**: Current work streams and their status
4. **Important References**: Links, files, or resources mentioned
5. **Action Items**: Pending tasks or follow-ups

Format your response as JSON:
{
  "summary": "Comprehensive narrative summary of the conversation",
  "keyTopics": ["topic1", "topic2", "topic3"],
  "technicalDetails": ["detail1", "detail2"],
  "ongoingProjects": [{"name": "project", "status": "status", "details": "details"}],
  "actionItems": ["item1", "item2"],
  "importantReferences": ["ref1", "ref2"],
  "timeframe": "human-readable time period",
  "characterCount": estimated_character_count_of_original
}

Keep the summary comprehensive but concise. This will be used to maintain context in future conversations.`;

  return prompt;
}

/**
 * Handle completion of the compaction process
 */
function handleCompactionCompletion(compactionData) {
  const { threadId, summaryResult, originalMessage, compactionContext } = compactionData;
  
  try {
    // Parse the Claude Code summary result
    const summaryJson = JSON.parse(summaryResult);
    
    // Create new memory segment
    const newMemorySegment = {
      id: `segment_${Date.now()}`,
      timestamp: new Date().toISOString(),
      summary: summaryJson.summary,
      keyTopics: summaryJson.keyTopics || [],
      technicalDetails: summaryJson.technicalDetails || [],
      ongoingProjects: summaryJson.ongoingProjects || [],
      actionItems: summaryJson.actionItems || [],
      importantReferences: summaryJson.importantReferences || [],
      timeframe: summaryJson.timeframe || 'recent period',
      originalCharacterCount: summaryJson.characterCount || 0,
      compressedCharacterCount: summaryResult.length
    };
    
    // Update workflow static data with new memory segment
    const staticData = $workflow.staticData || {};
    const contextKey = `context_${compactionContext.originalThreadId}`;
    const currentContext = staticData[contextKey] || {};
    
    // Reset context stats and add new memory segment
    const updatedContext = {
      messageCount: 0, // Reset message count
      totalCharacters: 0, // Reset character count
      lastCompaction: new Date().toISOString(),
      memorySegments: [...(currentContext.memorySegments || []), newMemorySegment].slice(-10), // Keep last 10 segments
      recentMessages: [], // Clear recent messages
      createdAt: currentContext.createdAt || new Date().toISOString(),
      compactionHistory: [...(currentContext.compactionHistory || []), {
        timestamp: new Date().toISOString(),
        reason: compactionData.compactionReason || 'auto-compaction',
        segmentId: newMemorySegment.id,
        reductionPercentage: calculateReductionPercentage(newMemorySegment)
      }].slice(-5) // Keep last 5 compaction records
    };
    
    staticData[contextKey] = updatedContext;
    
    return {
      threadId: compactionContext.originalThreadId,
      channel: compactionData.channel,
      compactionResult: 'success',
      newMemorySegment: newMemorySegment,
      reductionPercentage: calculateReductionPercentage(newMemorySegment),
      updatedContext: updatedContext
    };
    
  } catch (error) {
    console.error('Failed to parse compaction summary:', error);
    
    // Fallback: create basic memory segment
    const fallbackSegment = {
      id: `segment_${Date.now()}`,
      timestamp: new Date().toISOString(),
      summary: `Conversation summary (${compactionContext.contextStats.messageCount} messages, auto-compacted due to context limits)`,
      keyTopics: ['collaborative-work'],
      error: 'parsing_failed',
      originalCharacterCount: compactionContext.contextStats.totalCharacters,
      compressedCharacterCount: 500
    };
    
    return {
      threadId: compactionContext.originalThreadId,
      channel: compactionData.channel,
      compactionResult: 'partial_success',
      newMemorySegment: fallbackSegment,
      error: error.message
    };
  }
}

/**
 * Calculate reduction percentage achieved by compaction
 */
function calculateReductionPercentage(memorySegment) {
  if (!memorySegment.originalCharacterCount || memorySegment.originalCharacterCount === 0) {
    return 0;
  }
  
  const reduction = ((memorySegment.originalCharacterCount - memorySegment.compressedCharacterCount) / memorySegment.originalCharacterCount) * 100;
  return Math.round(reduction);
}

/**
 * Create status update for compaction progress
 */
function createCompactionStatusUpdate(stage, data, channel) {
  const statusMessages = {
    starting: {
      icon: '🔄',
      title: 'Auto-Compaction Starting',
      description: `Optimizing conversation context to maintain performance`,
      color: '#0066cc'
    },
    summarizing: {
      icon: '🧠',
      title: 'Summarizing Conversation',
      description: `Creating intelligent summary of ${data.messagesToSummarize || 'recent'} messages`,
      color: '#ff9900'
    },
    completed: {
      icon: '✅',
      title: 'Compaction Completed',
      description: `Context optimized successfully`,
      color: '#00cc66'
    }
  };
  
  const status = statusMessages[stage] || statusMessages.starting;
  
  return {
    channel: channel,
    compactionStatus: stage,
    statusIcon: status.icon,
    statusTitle: status.title,
    statusDescription: status.description,
    statusColor: status.color,
    statusData: data,
    timestamp: new Date().toISOString()
  };
}

// Execute the main function
return manageAutoCompaction();