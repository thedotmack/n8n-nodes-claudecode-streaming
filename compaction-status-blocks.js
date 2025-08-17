// Compaction Status Block Kit Messages
// Creates rich, professional status updates during auto-compaction process

/**
 * Main function to create compaction status Block Kit messages
 */
function createCompactionStatusBlocks() {
  const items = $input.all();
  
  if (!items || items.length === 0) {
    return [];
  }

  const results = [];
  
  for (const item of items) {
    const { compactionAction, compactionStage } = item.json;
    
    if (compactionAction === 'send_status') {
      const blockKitMessage = createStatusBlockKit(item.json);
      
      results.push({
        json: {
          ...blockKitMessage,
          messageType: 'compaction_status',
          stage: compactionStage
        }
      });
    }
  }
  
  return results;
}

/**
 * Create Block Kit message based on compaction stage
 */
function createStatusBlockKit(statusData) {
  const { compactionStage, channel } = statusData;
  
  switch (compactionStage) {
    case 'starting':
      return createStartingBlocks(statusData);
    case 'summarizing':
      return createSummarizingBlocks(statusData);
    case 'completed':
      return createCompletedBlocks(statusData);
    default:
      return createGenericStatusBlocks(statusData);
  }
}

/**
 * Create starting compaction status blocks
 */
function createStartingBlocks(statusData) {
  const { statusData: compactionPlan, channel } = statusData;
  
  const blocks = [
    {
      "type": "header",
      "text": {
        "type": "plain_text",
        "text": "🔄 Auto-Compaction Starting"
      }
    },
    {
      "type": "section",
      "text": {
        "type": "mrkdwn",
        "text": `*Context optimization in progress*\\n\\nYour collaborative conversation is being optimized to maintain peak performance. This process will preserve all important information while reducing memory usage.`
      }
    },
    {
      "type": "section",
      "fields": [
        {
          "type": "mrkdwn",
          "text": `*Total Messages:*\\n${compactionPlan.totalMessages || 'N/A'}`
        },
        {
          "type": "mrkdwn",
          "text": `*Messages to Summarize:*\\n${compactionPlan.messagesToSummarize || 'N/A'}`
        },
        {
          "type": "mrkdwn",
          "text": `*Messages to Keep:*\\n${compactionPlan.messagesToKeep || 'N/A'}`
        },
        {
          "type": "mrkdwn",
          "text": `*Compaction Type:*\\n${formatCompactionType(compactionPlan.compactionType)}`
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
        "text": "⏳ *Status:* Initializing compaction process..."
      }
    },
    {
      "type": "context",
      "elements": [
        {
          "type": "mrkdwn",
          "text": `🤖 Automated memory management • ${new Date().toLocaleTimeString()}`
        }
      ]
    }
  ];

  return {
    channel: channel,
    blocks: JSON.stringify(blocks),
    text: "🔄 Auto-Compaction Starting - Context optimization in progress"
  };
}

/**
 * Create summarizing status blocks
 */
function createSummarizingBlocks(statusData) {
  const { statusData: compactionPlan, channel } = statusData;
  
  const blocks = [
    {
      "type": "header",
      "text": {
        "type": "plain_text",
        "text": "🧠 Intelligent Summarization"
      }
    },
    {
      "type": "section",
      "text": {
        "type": "mrkdwn",
        "text": `*Claude Code is creating an intelligent summary*\\n\\nAnalyzing conversation history to extract key topics, decisions, technical details, and ongoing projects. This ensures nothing important is lost during optimization.`
      }
    },
    {
      "type": "section",
      "fields": [
        {
          "type": "mrkdwn",
          "text": `*Processing:*\\n${compactionPlan.messagesToSummarize || 'N/A'} messages`
        },
        {
          "type": "mrkdwn",
          "text": `*Target Reduction:*\\n${compactionPlan.targetReduction || 50}%`
        },
        {
          "type": "mrkdwn",
          "text": `*Memory Segments:*\\n${compactionPlan.existingMemorySegments || 0} existing`
        },
        {
          "type": "mrkdwn",
          "text": `*Estimated New:*\\n${compactionPlan.estimatedNewSegments || 1} segments`
        }
      ]
    },
    {
      "type": "section",
      "text": {
        "type": "mrkdwn",
        "text": "*What's being preserved:*\\n• 🎯 Key topics and decisions\\n• 🔧 Technical details and code\\n• 📋 Ongoing projects and status\\n• 🔗 Important references and links\\n• ✅ Action items and follow-ups"
      }
    },
    {
      "type": "divider"
    },
    {
      "type": "section",
      "text": {
        "type": "mrkdwn",
        "text": "🧠 *Status:* Creating intelligent summary..."
      },
      "accessory": {
        "type": "image",
        "image_url": "https://api.slack.com/img/blocks/bkb_template_images/loading.gif",
        "alt_text": "Processing"
      }
    },
    {
      "type": "context",
      "elements": [
        {
          "type": "mrkdwn",
          "text": `⚡ AI-powered conversation analysis • ${new Date().toLocaleTimeString()}`
        }
      ]
    }
  ];

  return {
    channel: channel,
    blocks: JSON.stringify(blocks),
    text: "🧠 Intelligent Summarization - Creating conversation summary"
  };
}

/**
 * Create completion status blocks
 */
function createCompletedBlocks(statusData) {
  const { newMemorySegment, reductionPercentage, updatedContext, channel, compactionResult } = statusData;
  
  const isSuccess = compactionResult === 'success';
  const headerText = isSuccess ? "✅ Compaction Completed Successfully" : "⚠️ Compaction Completed with Issues";
  
  const blocks = [
    {
      "type": "header",
      "text": {
        "type": "plain_text",
        "text": headerText
      }
    },
    {
      "type": "section",
      "text": {
        "type": "mrkdwn",
        "text": isSuccess ? 
          `*Context optimization completed successfully!*\\n\\nYour collaborative conversation has been optimized while preserving all important information. The chat is ready for continued collaboration.` :
          `*Context optimization completed with some issues.*\\n\\nBasic optimization was performed, but there may have been issues with advanced summarization. The chat is still functional.`
      }
    }
  ];

  // Add success metrics if available
  if (isSuccess && newMemorySegment) {
    blocks.push({
      "type": "section",
      "fields": [
        {
          "type": "mrkdwn",
          "text": `*Memory Reduction:*\\n${reductionPercentage || 'N/A'}% saved`
        },
        {
          "type": "mrkdwn",
          "text": `*New Segment Created:*\\n${formatTimestamp(newMemorySegment.timestamp)}`
        },
        {
          "type": "mrkdwn",
          "text": `*Total Memory Segments:*\\n${updatedContext?.memorySegments?.length || 'N/A'}`
        },
        {
          "type": "mrkdwn",
          "text": `*Context Reset:*\\nReady for new messages`
        }
      ]
    });

    // Add memory preview if available
    if (newMemorySegment.keyTopics && newMemorySegment.keyTopics.length > 0) {
      const topicsPreview = newMemorySegment.keyTopics.slice(0, 5).map(topic => `• ${topic}`).join('\\n');
      
      blocks.push({
        "type": "section",
        "text": {
          "type": "mrkdwn",
          "text": `*Key Topics Preserved:*\\n${topicsPreview}${newMemorySegment.keyTopics.length > 5 ? '\\n_...and more_' : ''}`
        }
      });
    }

    // Add ongoing projects if available
    if (newMemorySegment.ongoingProjects && newMemorySegment.ongoingProjects.length > 0) {
      const projectsPreview = newMemorySegment.ongoingProjects.slice(0, 3).map(project => 
        `• ${project.name}: ${project.status}`
      ).join('\\n');
      
      blocks.push({
        "type": "section",
        "text": {
          "type": "mrkdwn",
          "text": `*Ongoing Projects:*\\n${projectsPreview}`
        }
      });
    }
  }

  blocks.push({
    "type": "divider"
  });

  blocks.push({
    "type": "section",
    "text": {
      "type": "mrkdwn",
      "text": isSuccess ? 
        "🚀 *Ready for continued collaboration!* Your next message will start fresh with optimized context." :
        "⚠️ *Chat ready with basic optimization.* You can continue collaborating normally."
    }
  });

  blocks.push({
    "type": "context",
    "elements": [
      {
        "type": "mrkdwn",
        "text": `✨ Context optimized • Memory preserved • ${new Date().toLocaleTimeString()}`
      }
    ]
  });

  return {
    channel: channel,
    blocks: JSON.stringify(blocks),
    text: isSuccess ? 
      "✅ Compaction Completed - Context optimized successfully" :
      "⚠️ Compaction Completed - Basic optimization performed"
  };
}

/**
 * Create generic status blocks for unknown stages
 */
function createGenericStatusBlocks(statusData) {
  const { channel, statusIcon, statusTitle, statusDescription } = statusData;
  
  const blocks = [
    {
      "type": "section",
      "text": {
        "type": "mrkdwn",
        "text": `${statusIcon || '🔄'} *${statusTitle || 'Auto-Compaction Update'}*\\n\\n${statusDescription || 'Processing context optimization...'}`
      }
    },
    {
      "type": "context",
      "elements": [
        {
          "type": "mrkdwn",
          "text": `🤖 Automated process • ${new Date().toLocaleTimeString()}`
        }
      ]
    }
  ];

  return {
    channel: channel,
    blocks: JSON.stringify(blocks),
    text: `${statusIcon || '🔄'} ${statusTitle || 'Auto-Compaction Update'}`
  };
}

/**
 * Helper function to format compaction type
 */
function formatCompactionType(type) {
  const types = {
    'memory_consolidation': 'Memory Consolidation',
    'message_summarization': 'Message Summarization', 
    'context_optimization': 'Context Optimization'
  };
  
  return types[type] || 'Standard Optimization';
}

/**
 * Helper function to format timestamp
 */
function formatTimestamp(timestamp) {
  if (!timestamp) return 'Recently';
  
  const date = new Date(timestamp);
  return date.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
}

/**
 * Create progress indicator based on stage
 */
function createProgressIndicator(currentStage) {
  const stages = ['starting', 'summarizing', 'storing', 'completed'];
  const currentIndex = stages.indexOf(currentStage);
  
  if (currentIndex === -1) return '🔄 Processing...';
  
  const progress = ((currentIndex + 1) / stages.length) * 100;
  const progressBar = '█'.repeat(Math.floor(progress / 10)) + '░'.repeat(10 - Math.floor(progress / 10));
  
  return `${progressBar} ${Math.round(progress)}%`;
}

// Execute the main function
return createCompactionStatusBlocks();