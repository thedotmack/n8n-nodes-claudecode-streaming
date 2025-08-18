# Multi-Agent Slack Router Implementation Plan

## Objective
Implement a router workflow to handle multiple Slack channels where each channel connects to a different Claude Code instance with unique personalities, building on existing streaming infrastructure.

## Architecture Decision: Router Pattern

**Selected Approach:** Single router workflow that routes messages to appropriate agent personalities
**Rejected:** Multiple separate workflows (inefficient, harder to maintain)

## Implementation Components

### 1. Channel Router Workflow
- **Purpose:** Main workflow receiving all Slack messages and routing to correct agent
- **Input:** Slack webhook events from multiple channels
- **Output:** Routed to appropriate Claude Code instance with personality context
- **Integration:** Leverages existing real-time streaming infrastructure

### 2. Agent Configuration System
- **Channel Mapping:** Map Slack channel IDs to agent personalities
- **Configuration Format:**
  ```json
  {
    "C1234567890": "empire-ceo-agent",
    "C1234567891": "empire-product-hunter-agent", 
    "C1234567892": "empire-store-builder-agent"
  }
  ```
- **Agent Registry:** Map agent names to CLAUDE.md file paths

### 3. Dynamic Personality Loading
- **CLAUDE.md Reader:** Load personality instructions from agent folders
- **Context Injection:** Prepend personality context to Claude Code requests
- **Caching:** Cache loaded personalities for performance

### 4. Conversation Persistence Strategy
- **Per-Channel Tracking:** Maintain separate conversation threads per channel
- **Thread Management:** Use channel ID as conversation identifier
- **SDK Integration:** Leverage Claude Code SDK's built-in persistence with channel-specific contexts

### 5. Response Routing System
- **Channel Targeting:** Route Claude Code responses back to originating Slack channel
- **Streaming Integration:** Real-time streaming updates to correct channel
- **Error Handling:** Channel-specific error responses

## Technical Implementation Steps

### Step 1: Create Router Workflow
- New n8n workflow: `multi-agent-slack-router.json`
- Slack webhook trigger for all channels
- Channel identification logic
- Agent personality routing

### Step 2: Channel-Agent Configuration
- Configuration node or JSON file with channel mappings
- Agent folder path mapping
- Dynamic personality loading function

### Step 3: Enhance Claude Code Node
- Add channel context parameter
- Implement personality injection logic
- Modify streaming to include channel targeting

### Step 4: Update Streaming Infrastructure
- Modify streaming webhook to handle channel-specific routing
- Update Slack response formatting for multi-channel support
- Ensure proper thread management per channel

### Step 5: Agent Integration
- Verify existing agent folder structure compatibility
- Test CLAUDE.md loading for each agent personality
- Validate conversation persistence per channel

## Benefits of Router Approach

1. **Resource Efficiency:** Single workflow vs 7 separate workflows
2. **Maintenance:** Centralized configuration and updates
3. **Scalability:** Easy to add new agents/channels
4. **Infrastructure Reuse:** Leverages existing streaming system
5. **Consistency:** Unified error handling and logging

## Testing Strategy

1. **Single Channel Test:** Verify one agent personality works correctly
2. **Multi-Channel Test:** Test concurrent requests from different channels  
3. **Personality Switching:** Confirm correct agent responses per channel
4. **Streaming Validation:** Verify real-time updates reach correct channels
5. **Error Scenarios:** Test channel mapping failures and fallback behavior

## Dependencies

- Existing Claude Code Streaming node infrastructure
- Real-time streaming webhook system
- Agent folder structure with CLAUDE.md files
- Slack workspace with multiple channels configured
- n8n instance at https://n8n.empire.markets

## Success Criteria

- Multiple Slack channels receive responses from correct agent personalities
- Real-time streaming works independently per channel
- Conversation persistence maintained separately per channel
- Single workflow efficiently handles all agent routing
- Easy configuration for adding new agents/channels