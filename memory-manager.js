// Memory Manager for Persistent Collaborative Chat
// Handles storage, retrieval, and management of conversation memory

/**
 * Main memory management function
 * Handles all memory-related operations for persistent chat
 */
function manageMemory() {
  const items = $input.all();
  
  if (!items || items.length === 0) {
    return [];
  }

  const results = [];
  
  for (const item of items) {
    const { action } = item.json;
    
    switch (action) {
      case 'store_memory':
        results.push({ json: storeMemorySegment(item.json) });
        break;
      case 'retrieve_memory':
        results.push({ json: retrieveRelevantMemory(item.json) });
        break;
      case 'search_memory':
        results.push({ json: searchMemorySegments(item.json) });
        break;
      case 'consolidate_memory':
        results.push({ json: consolidateMemorySegments(item.json) });
        break;
      case 'get_memory_stats':
        results.push({ json: getMemoryStatistics(item.json) });
        break;
      default:
        // Pass through unchanged
        results.push(item);
    }
  }
  
  return results;
}

/**
 * Store a new memory segment in workflow static data
 */
function storeMemorySegment(data) {
  const { threadId, memorySegment, overwrite = false } = data;
  
  try {
    const staticData = $workflow.staticData || {};
    const memoryKey = `memory_${threadId}`;
    const currentMemory = staticData[memoryKey] || { segments: [], metadata: {} };
    
    // Validate memory segment
    if (!memorySegment || !memorySegment.id) {
      throw new Error('Invalid memory segment: missing required fields');
    }
    
    // Check if segment already exists
    const existingIndex = currentMemory.segments.findIndex(seg => seg.id === memorySegment.id);
    
    if (existingIndex >= 0) {
      if (overwrite) {
        currentMemory.segments[existingIndex] = {
          ...memorySegment,
          updatedAt: new Date().toISOString()
        };
      } else {
        throw new Error(`Memory segment ${memorySegment.id} already exists`);
      }
    } else {
      // Add new segment
      currentMemory.segments.push({
        ...memorySegment,
        createdAt: memorySegment.createdAt || new Date().toISOString(),
        updatedAt: new Date().toISOString()
      });
    }
    
    // Maintain segment limit (keep last 15 segments)
    if (currentMemory.segments.length > 15) {
      const removedSegments = currentMemory.segments.splice(0, currentMemory.segments.length - 15);
      currentMemory.metadata.removedSegments = (currentMemory.metadata.removedSegments || 0) + removedSegments.length;
    }
    
    // Update metadata
    currentMemory.metadata = {
      ...currentMemory.metadata,
      lastUpdated: new Date().toISOString(),
      totalSegments: currentMemory.segments.length,
      threadId: threadId
    };
    
    // Store back to static data
    staticData[memoryKey] = currentMemory;
    
    return {
      action: 'memory_stored',
      threadId: threadId,
      segmentId: memorySegment.id,
      success: true,
      totalSegments: currentMemory.segments.length,
      timestamp: new Date().toISOString()
    };
    
  } catch (error) {
    return {
      action: 'memory_storage_failed',
      threadId: threadId,
      error: error.message,
      success: false,
      timestamp: new Date().toISOString()
    };
  }
}

/**
 * Retrieve relevant memory segments for a given context
 */
function retrieveRelevantMemory(data) {
  const { threadId, query, limit = 5, includeRecent = true } = data;
  
  try {
    const staticData = $workflow.staticData || {};
    const memoryKey = `memory_${threadId}`;
    const memoryData = staticData[memoryKey];
    
    if (!memoryData || !memoryData.segments || memoryData.segments.length === 0) {
      return {
        action: 'memory_retrieved',
        threadId: threadId,
        segments: [],
        totalFound: 0,
        message: 'No memory segments found for this thread'
      };
    }
    
    const allSegments = memoryData.segments;
    let relevantSegments = [];
    
    if (query && query.trim()) {
      // Search for relevant segments based on query
      const queryLower = query.toLowerCase();
      
      relevantSegments = allSegments.filter(segment => {
        // Search in summary
        if (segment.summary && segment.summary.toLowerCase().includes(queryLower)) {
          return true;
        }
        
        // Search in key topics
        if (segment.keyTopics && segment.keyTopics.some(topic => 
          topic.toLowerCase().includes(queryLower))) {
          return true;
        }
        
        // Search in technical details
        if (segment.technicalDetails && segment.technicalDetails.some(detail => 
          detail.toLowerCase().includes(queryLower))) {
          return true;
        }
        
        // Search in ongoing projects
        if (segment.ongoingProjects && segment.ongoingProjects.some(project => 
          project.name.toLowerCase().includes(queryLower) || 
          project.details.toLowerCase().includes(queryLower))) {
          return true;
        }
        
        return false;
      });
      
      // Sort by relevance (simple scoring)
      relevantSegments.sort((a, b) => {
        const scoreA = calculateRelevanceScore(a, queryLower);
        const scoreB = calculateRelevanceScore(b, queryLower);
        return scoreB - scoreA;
      });
    } else {
      // No specific query, return recent segments
      relevantSegments = allSegments.slice(); // Copy array
    }
    
    // Include recent segments if requested
    if (includeRecent && relevantSegments.length < limit) {
      const recentSegments = allSegments
        .slice(-3) // Last 3 segments
        .filter(seg => !relevantSegments.find(rel => rel.id === seg.id));
      
      relevantSegments = [...relevantSegments, ...recentSegments];
    }
    
    // Limit results
    const limitedSegments = relevantSegments.slice(0, limit);
    
    return {
      action: 'memory_retrieved',
      threadId: threadId,
      segments: limitedSegments.map(segment => formatSegmentForRetrieval(segment)),
      totalFound: relevantSegments.length,
      totalAvailable: allSegments.length,
      query: query || 'recent',
      timestamp: new Date().toISOString()
    };
    
  } catch (error) {
    return {
      action: 'memory_retrieval_failed',
      threadId: threadId,
      error: error.message,
      timestamp: new Date().toISOString()
    };
  }
}

/**
 * Calculate relevance score for memory segment
 */
function calculateRelevanceScore(segment, queryLower) {
  let score = 0;
  
  // Summary matches (highest weight)
  if (segment.summary && segment.summary.toLowerCase().includes(queryLower)) {
    score += 10;
  }
  
  // Key topics matches
  if (segment.keyTopics) {
    score += segment.keyTopics.filter(topic => 
      topic.toLowerCase().includes(queryLower)).length * 5;
  }
  
  // Technical details matches
  if (segment.technicalDetails) {
    score += segment.technicalDetails.filter(detail => 
      detail.toLowerCase().includes(queryLower)).length * 3;
  }
  
  // Recent segments get bonus
  const segmentAge = new Date().getTime() - new Date(segment.createdAt || 0).getTime();
  const daysSinceCreation = segmentAge / (1000 * 60 * 60 * 24);
  if (daysSinceCreation < 7) {
    score += 2; // Recent bonus
  }
  
  return score;
}

/**
 * Format memory segment for retrieval (remove sensitive data, format for display)
 */
function formatSegmentForRetrieval(segment) {
  return {
    id: segment.id,
    timestamp: segment.createdAt || segment.timestamp,
    summary: segment.summary,
    keyTopics: segment.keyTopics || [],
    technicalDetails: segment.technicalDetails || [],
    ongoingProjects: segment.ongoingProjects || [],
    actionItems: segment.actionItems || [],
    timeframe: segment.timeframe || 'recent',
    age: calculateSegmentAge(segment.createdAt || segment.timestamp)
  };
}

/**
 * Calculate human-readable age of memory segment
 */
function calculateSegmentAge(timestamp) {
  if (!timestamp) return 'unknown';
  
  const age = new Date().getTime() - new Date(timestamp).getTime();
  const days = Math.floor(age / (1000 * 60 * 60 * 24));
  const hours = Math.floor(age / (1000 * 60 * 60));
  const minutes = Math.floor(age / (1000 * 60));
  
  if (days > 0) {
    return `${days} day${days !== 1 ? 's' : ''} ago`;
  } else if (hours > 0) {
    return `${hours} hour${hours !== 1 ? 's' : ''} ago`;
  } else if (minutes > 0) {
    return `${minutes} minute${minutes !== 1 ? 's' : ''} ago`;
  } else {
    return 'just now';
  }
}

/**
 * Search memory segments with advanced filtering
 */
function searchMemorySegments(data) {
  const { threadId, searchTerms, filters = {}, sortBy = 'relevance' } = data;
  
  try {
    const staticData = $workflow.staticData || {};
    const memoryKey = `memory_${threadId}`;
    const memoryData = staticData[memoryKey];
    
    if (!memoryData || !memoryData.segments) {
      return {
        action: 'memory_search_completed',
        results: [],
        totalFound: 0,
        message: 'No memory segments to search'
      };
    }
    
    let segments = memoryData.segments.slice(); // Copy array
    
    // Apply search terms
    if (searchTerms && searchTerms.length > 0) {
      segments = segments.filter(segment => {
        return searchTerms.some(term => {
          const termLower = term.toLowerCase();
          return (
            (segment.summary && segment.summary.toLowerCase().includes(termLower)) ||
            (segment.keyTopics && segment.keyTopics.some(topic => 
              topic.toLowerCase().includes(termLower))) ||
            (segment.technicalDetails && segment.technicalDetails.some(detail => 
              detail.toLowerCase().includes(termLower)))
          );
        });
      });
    }
    
    // Apply filters
    if (filters.timeframe) {
      const timeframeStart = new Date();
      switch (filters.timeframe) {
        case 'today':
          timeframeStart.setHours(0, 0, 0, 0);
          break;
        case 'week':
          timeframeStart.setDate(timeframeStart.getDate() - 7);
          break;
        case 'month':
          timeframeStart.setMonth(timeframeStart.getMonth() - 1);
          break;
      }
      
      segments = segments.filter(segment => {
        const segmentDate = new Date(segment.createdAt || segment.timestamp);
        return segmentDate >= timeframeStart;
      });
    }
    
    if (filters.hasProjects) {
      segments = segments.filter(segment => 
        segment.ongoingProjects && segment.ongoingProjects.length > 0);
    }
    
    if (filters.hasActionItems) {
      segments = segments.filter(segment => 
        segment.actionItems && segment.actionItems.length > 0);
    }
    
    // Sort results
    if (sortBy === 'date') {
      segments.sort((a, b) => {
        const dateA = new Date(a.createdAt || a.timestamp);
        const dateB = new Date(b.createdAt || b.timestamp);
        return dateB - dateA; // Newest first
      });
    } else if (sortBy === 'relevance' && searchTerms) {
      segments.sort((a, b) => {
        const scoreA = searchTerms.reduce((score, term) => 
          score + calculateRelevanceScore(a, term.toLowerCase()), 0);
        const scoreB = searchTerms.reduce((score, term) => 
          score + calculateRelevanceScore(b, term.toLowerCase()), 0);
        return scoreB - scoreA;
      });
    }
    
    return {
      action: 'memory_search_completed',
      threadId: threadId,
      results: segments.map(segment => formatSegmentForRetrieval(segment)),
      totalFound: segments.length,
      totalAvailable: memoryData.segments.length,
      searchTerms: searchTerms,
      filters: filters,
      sortBy: sortBy,
      timestamp: new Date().toISOString()
    };
    
  } catch (error) {
    return {
      action: 'memory_search_failed',
      threadId: threadId,
      error: error.message,
      timestamp: new Date().toISOString()
    };
  }
}

/**
 * Consolidate memory segments when they become too numerous
 */
function consolidateMemorySegments(data) {
  const { threadId, maxSegments = 10 } = data;
  
  try {
    const staticData = $workflow.staticData || {};
    const memoryKey = `memory_${threadId}`;
    const memoryData = staticData[memoryKey];
    
    if (!memoryData || !memoryData.segments || memoryData.segments.length <= maxSegments) {
      return {
        action: 'consolidation_not_needed',
        threadId: threadId,
        currentSegments: memoryData?.segments?.length || 0,
        maxSegments: maxSegments
      };
    }
    
    const segments = memoryData.segments;
    
    // Group older segments for consolidation (keep newest ones intact)
    const keepSegments = segments.slice(-maxSegments + 2); // Keep last segments
    const consolidateSegments = segments.slice(0, segments.length - maxSegments + 2);
    
    if (consolidateSegments.length === 0) {
      return {
        action: 'consolidation_not_needed',
        threadId: threadId,
        message: 'No segments need consolidation'
      };
    }
    
    // Create consolidated segment
    const consolidatedSegment = {
      id: `consolidated_${Date.now()}`,
      type: 'consolidated',
      createdAt: new Date().toISOString(),
      summary: createConsolidatedSummary(consolidateSegments),
      keyTopics: extractUniqueTopics(consolidateSegments),
      technicalDetails: extractUniqueTechnicalDetails(consolidateSegments),
      ongoingProjects: extractOngoingProjects(consolidateSegments),
      timeframe: `${consolidateSegments.length} segments from ${formatTimestamp(consolidateSegments[0].createdAt)} to ${formatTimestamp(consolidateSegments[consolidateSegments.length - 1].createdAt)}`,
      consolidatedSegmentIds: consolidateSegments.map(seg => seg.id),
      originalCharacterCount: consolidateSegments.reduce((total, seg) => 
        total + (seg.summary?.length || 0), 0)
    };
    
    // Update memory data
    const updatedSegments = [consolidatedSegment, ...keepSegments];
    memoryData.segments = updatedSegments;
    memoryData.metadata = {
      ...memoryData.metadata,
      lastConsolidation: new Date().toISOString(),
      consolidationCount: (memoryData.metadata.consolidationCount || 0) + 1
    };
    
    staticData[memoryKey] = memoryData;
    
    return {
      action: 'memory_consolidated',
      threadId: threadId,
      consolidatedSegmentId: consolidatedSegment.id,
      segmentsConsolidated: consolidateSegments.length,
      segmentsRemaining: updatedSegments.length,
      reductionPercentage: Math.round(((segments.length - updatedSegments.length) / segments.length) * 100),
      timestamp: new Date().toISOString()
    };
    
  } catch (error) {
    return {
      action: 'consolidation_failed',
      threadId: threadId,
      error: error.message,
      timestamp: new Date().toISOString()
    };
  }
}

/**
 * Create consolidated summary from multiple segments
 */
function createConsolidatedSummary(segments) {
  const summaries = segments.map(seg => seg.summary).filter(Boolean);
  
  if (summaries.length === 0) {
    return `Consolidated ${segments.length} memory segments`;
  }
  
  // Create a combined summary (simplified approach)
  const keyPhrases = [];
  summaries.forEach(summary => {
    // Extract key phrases (simplified - look for sentences with important keywords)
    const sentences = summary.split('.').filter(s => s.trim());
    sentences.forEach(sentence => {
      if (sentence.includes('implemented') || sentence.includes('created') || 
          sentence.includes('discussed') || sentence.includes('decided') ||
          sentence.includes('working on') || sentence.includes('project')) {
        keyPhrases.push(sentence.trim());
      }
    });
  });
  
  const uniquePhrases = [...new Set(keyPhrases)].slice(0, 10);
  
  return `Consolidated memory from ${segments.length} conversation segments. Key activities: ${uniquePhrases.join('. ')}.`;
}

/**
 * Extract unique topics from multiple segments
 */
function extractUniqueTopics(segments) {
  const allTopics = segments.flatMap(seg => seg.keyTopics || []);
  return [...new Set(allTopics)].slice(0, 20); // Limit to 20 unique topics
}

/**
 * Extract unique technical details from multiple segments
 */
function extractUniqueTechnicalDetails(segments) {
  const allDetails = segments.flatMap(seg => seg.technicalDetails || []);
  return [...new Set(allDetails)].slice(0, 15); // Limit to 15 unique details
}

/**
 * Extract and merge ongoing projects from multiple segments
 */
function extractOngoingProjects(segments) {
  const projectMap = new Map();
  
  segments.forEach(segment => {
    if (segment.ongoingProjects) {
      segment.ongoingProjects.forEach(project => {
        if (projectMap.has(project.name)) {
          // Merge project details (keep most recent status)
          const existing = projectMap.get(project.name);
          projectMap.set(project.name, {
            ...existing,
            status: project.status || existing.status,
            details: project.details || existing.details
          });
        } else {
          projectMap.set(project.name, project);
        }
      });
    }
  });
  
  return Array.from(projectMap.values());
}

/**
 * Get comprehensive memory statistics
 */
function getMemoryStatistics(data) {
  const { threadId } = data;
  
  try {
    const staticData = $workflow.staticData || {};
    const memoryKey = `memory_${threadId}`;
    const memoryData = staticData[memoryKey];
    
    if (!memoryData) {
      return {
        action: 'memory_stats_retrieved',
        threadId: threadId,
        exists: false,
        message: 'No memory data found for this thread'
      };
    }
    
    const segments = memoryData.segments || [];
    const metadata = memoryData.metadata || {};
    
    // Calculate statistics
    const totalSegments = segments.length;
    const totalCharacters = segments.reduce((total, seg) => 
      total + (seg.summary?.length || 0), 0);
    
    const topicCounts = {};
    segments.forEach(seg => {
      if (seg.keyTopics) {
        seg.keyTopics.forEach(topic => {
          topicCounts[topic] = (topicCounts[topic] || 0) + 1;
        });
      }
    });
    
    const topTopics = Object.entries(topicCounts)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 10)
      .map(([topic, count]) => ({ topic, count }));
    
    const oldestSegment = segments.length > 0 ? 
      segments.reduce((oldest, seg) => {
        const segDate = new Date(seg.createdAt || seg.timestamp);
        const oldestDate = new Date(oldest.createdAt || oldest.timestamp);
        return segDate < oldestDate ? seg : oldest;
      }) : null;
    
    const newestSegment = segments.length > 0 ? 
      segments.reduce((newest, seg) => {
        const segDate = new Date(seg.createdAt || seg.timestamp);
        const newestDate = new Date(newest.createdAt || newest.timestamp);
        return segDate > newestDate ? seg : newest;
      }) : null;
    
    return {
      action: 'memory_stats_retrieved',
      threadId: threadId,
      exists: true,
      statistics: {
        totalSegments: totalSegments,
        totalCharacters: totalCharacters,
        averageSegmentSize: totalSegments > 0 ? Math.round(totalCharacters / totalSegments) : 0,
        topTopics: topTopics,
        consolidationCount: metadata.consolidationCount || 0,
        lastUpdated: metadata.lastUpdated,
        lastConsolidation: metadata.lastConsolidation,
        oldestSegment: oldestSegment ? {
          id: oldestSegment.id,
          date: oldestSegment.createdAt || oldestSegment.timestamp,
          age: calculateSegmentAge(oldestSegment.createdAt || oldestSegment.timestamp)
        } : null,
        newestSegment: newestSegment ? {
          id: newestSegment.id,
          date: newestSegment.createdAt || newestSegment.timestamp,
          age: calculateSegmentAge(newestSegment.createdAt || newestSegment.timestamp)
        } : null
      },
      timestamp: new Date().toISOString()
    };
    
  } catch (error) {
    return {
      action: 'memory_stats_failed',
      threadId: threadId,
      error: error.message,
      timestamp: new Date().toISOString()
    };
  }
}

/**
 * Format timestamp for display
 */
function formatTimestamp(timestamp) {
  if (!timestamp) return 'unknown';
  
  return new Date(timestamp).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
}

// Execute the main function
return manageMemory();