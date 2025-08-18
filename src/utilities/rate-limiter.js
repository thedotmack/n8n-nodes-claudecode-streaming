// Rate Limiter and Error Handler for Claude Code Streaming
// Prevents Slack API rate limits and handles errors gracefully

/**
 * Rate limiter with memory-based tracking
 */
class StreamingRateLimiter {
  constructor() {
    this.requests = new Map(); // threadId -> array of timestamps
    this.errors = new Map();   // threadId -> error count
    this.maxRequestsPerMinute = 50; // Slack rate limit
    this.maxErrorsPerThread = 3;
    this.cleanupInterval = 60000; // Clean old entries every minute
    
    // Start cleanup process
    this.startCleanup();
  }
  
  /**
   * Check if request should be allowed
   */
  shouldAllow(threadId) {
    const now = Date.now();
    const requests = this.requests.get(threadId) || [];
    
    // Remove requests older than 1 minute
    const recentRequests = requests.filter(time => now - time < 60000);
    
    // Check if we're under the rate limit
    if (recentRequests.length >= this.maxRequestsPerMinute) {
      return {
        allowed: false,
        reason: 'rate_limit_exceeded',
        waitTime: 60000 - (now - recentRequests[0])
      };
    }
    
    // Check error count
    const errorCount = this.errors.get(threadId) || 0;
    if (errorCount >= this.maxErrorsPerThread) {
      return {
        allowed: false,
        reason: 'too_many_errors',
        errorCount: errorCount
      };
    }
    
    // Record this request
    recentRequests.push(now);
    this.requests.set(threadId, recentRequests);
    
    return { allowed: true };
  }
  
  /**
   * Record an error for a thread
   */
  recordError(threadId, error) {
    const errorCount = (this.errors.get(threadId) || 0) + 1;
    this.errors.set(threadId, errorCount);
    
    console.log(`Error recorded for thread ${threadId}: ${error.message} (Count: ${errorCount})`);
  }
  
  /**
   * Reset error count for a thread
   */
  resetErrors(threadId) {
    this.errors.delete(threadId);
  }
  
  /**
   * Clean up old entries
   */
  cleanup() {
    const now = Date.now();
    const oneMinuteAgo = now - 60000;
    
    // Clean up old request timestamps
    for (const [threadId, requests] of this.requests.entries()) {
      const recentRequests = requests.filter(time => time > oneMinuteAgo);
      if (recentRequests.length === 0) {
        this.requests.delete(threadId);
      } else {
        this.requests.set(threadId, recentRequests);
      }\n    }\n    \n    // Clean up old errors (reset after 5 minutes)\n    const fiveMinutesAgo = now - 300000;\n    for (const [threadId, lastError] of this.errors.entries()) {\n      if (lastError < fiveMinutesAgo) {\n        this.errors.delete(threadId);\n      }\n    }\n  }\n  \n  /**\n   * Start periodic cleanup\n   */\n  startCleanup() {\n    setInterval(() => this.cleanup(), this.cleanupInterval);\n  }\n}\n\n// Global rate limiter instance\nconst rateLimiter = new StreamingRateLimiter();\n\n/**\n * Smart message batching to reduce API calls\n */\nfunction batchMessages(messages, maxBatchSize = 5) {\n  const batches = [];\n  const sortedMessages = messages.sort((a, b) => a.messageIndex - b.messageIndex);\n  \n  for (let i = 0; i < sortedMessages.length; i += maxBatchSize) {\n    batches.push(sortedMessages.slice(i, i + maxBatchSize));\n  }\n  \n  return batches;\n}\n\n/**\n * Error recovery strategies\n */\nfunction getErrorRecoveryStrategy(error, attempt = 1) {\n  const errorMessage = error.message || error.toString();\n  \n  // Slack-specific error handling\n  if (errorMessage.includes('rate_limited')) {\n    return {\n      strategy: 'delay_retry',\n      delay: Math.min(30000 * attempt, 300000), // Exponential backoff, max 5 minutes\n      maxAttempts: 3\n    };\n  }\n  \n  if (errorMessage.includes('channel_not_found') || errorMessage.includes('invalid_auth')) {\n    return {\n      strategy: 'fallback_message',\n      fallback: true\n    };\n  }\n  \n  if (errorMessage.includes('message_not_found')) {\n    return {\n      strategy: 'create_new_message',\n      createNew: true\n    };\n  }\n  \n  return {\n    strategy: 'log_and_continue',\n    skipUpdate: true\n  };\n}\n\n/**\n * Safe message sender with error handling\n */\nasync function safeSendMessage(messageData, attempt = 1) {\n  const { threadId } = messageData;\n  \n  try {\n    // Check rate limit\n    const rateLimitCheck = rateLimiter.shouldAllow(threadId);\n    if (!rateLimitCheck.allowed) {\n      console.log(`Rate limit check failed for ${threadId}: ${rateLimitCheck.reason}`);\n      \n      if (rateLimitCheck.reason === 'rate_limit_exceeded') {\n        // Wait and retry\n        await new Promise(resolve => setTimeout(resolve, rateLimitCheck.waitTime));\n        return safeSendMessage(messageData, attempt + 1);\n      }\n      \n      // Too many errors - skip this update\n      return {\n        success: false,\n        skipped: true,\n        reason: rateLimitCheck.reason\n      };\n    }\n    \n    // Message would be sent here in actual n8n workflow\n    // This is a placeholder for the Slack API call\n    console.log(`Sending message for thread ${threadId}:`, messageData.text);\n    \n    // Reset error count on successful send\n    rateLimiter.resetErrors(threadId);\n    \n    return {\n      success: true,\n      messageData: messageData\n    };\n    \n  } catch (error) {\n    console.error(`Error sending message for thread ${threadId}:`, error);\n    \n    // Record the error\n    rateLimiter.recordError(threadId, error);\n    \n    // Get recovery strategy\n    const recovery = getErrorRecoveryStrategy(error, attempt);\n    \n    switch (recovery.strategy) {\n      case 'delay_retry':\n        if (attempt < recovery.maxAttempts) {\n          console.log(`Retrying after ${recovery.delay}ms (attempt ${attempt + 1})`);\n          await new Promise(resolve => setTimeout(resolve, recovery.delay));\n          return safeSendMessage(messageData, attempt + 1);\n        }\n        break;\n        \n      case 'fallback_message':\n        return {\n          success: false,\n          fallback: true,\n          fallbackMessage: `⚠️ Update failed for Claude Code execution (Thread: ${threadId})`\n        };\n        \n      case 'create_new_message':\n        return {\n          success: false,\n          createNew: true,\n          newMessageData: {\n            ...messageData,\n            text: `🔄 New update: ${messageData.text}`\n          }\n        };\n    }\n    \n    return {\n      success: false,\n      error: error.message,\n      attempt: attempt\n    };\n  }\n}\n\n/**\n * Message queue for handling bursts of updates\n */\nclass MessageQueue {\n  constructor() {\n    this.queue = [];\n    this.processing = false;\n    this.processInterval = 2000; // Process every 2 seconds\n  }\n  \n  add(messageData) {\n    this.queue.push({\n      ...messageData,\n      addedAt: Date.now()\n    });\n    \n    this.startProcessing();\n  }\n  \n  async startProcessing() {\n    if (this.processing) return;\n    \n    this.processing = true;\n    \n    while (this.queue.length > 0) {\n      const batch = this.queue.splice(0, 3); // Process 3 at a time\n      \n      for (const message of batch) {\n        await safeSendMessage(message);\n      }\n      \n      // Wait between batches\n      if (this.queue.length > 0) {\n        await new Promise(resolve => setTimeout(resolve, this.processInterval));\n      }\n    }\n    \n    this.processing = false;\n  }\n}\n\n// Export for use in n8n Code nodes\nif (typeof module !== 'undefined' && module.exports) {\n  module.exports = {\n    StreamingRateLimiter,\n    rateLimiter,\n    batchMessages,\n    safeSendMessage,\n    MessageQueue,\n    getErrorRecoveryStrategy\n  };\n}"