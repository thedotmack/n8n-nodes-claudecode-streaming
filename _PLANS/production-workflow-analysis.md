# Production Workflow Analysis

## Current Workflow: PERSISTENT_COLLABORATIVE_WORKFLOW.json

### Purpose
Persistent collaborative chat in tom-docs Slack channel (C09ANU1Q0QZ) with real-time streaming updates and auto-compaction.

### Current Flow

**1. Slack Trigger** (`On Message Received`)
- Monitors tom-docs channel (C09ANU1Q0QZ)
- Filters for specific users: U09A8P90WJZ, U099X4RDR8X, USLACKBOT, U099YKRV92P
- Uses webhook ID: 8ff651f2-5030-47a5-a8d6-ed44a0fc89f6

**2. Filter Noise** 
- Filters file_share subtypes and messages without subtypes
- Connects to both Context Monitor and Add Reaction

**3. Add Reaction**
- Adds "eyes" reaction to acknowledge message processing
- Uses tom-docs channel

**4. Context Monitor** (BROKEN - loads deleted context-monitor.js)
- Checks thread existence in static data
- Determines if compaction is needed
- Routes to Action Switch

**5. Action Switch**
- Routes based on action: create_thread, trigger_compaction, normal_processing
- Three outputs to different processing paths

**6. Auto-Compaction Manager** (BROKEN - loads deleted auto-compaction-manager.js)
- Manages compaction process when context gets too large
- Creates compaction plans and summarization requests

**7. Compaction Status Blocks** (BROKEN - loads deleted compaction-status-blocks.js)
- Creates Block Kit messages for compaction status updates

**8. Claude Code Create Thread** (BROKEN - uses old operations)
- operation: "create"
- Wrong node type: "@thedotmack/n8n-nodes-claudecode-streaming.claudeCodeStreaming"
- Has dual outputs - main and streaming

**9. Initialize Thread** 
- Sets static data after thread creation
- Initializes context stats

**10. Claude Code Persistent** (BROKEN - uses old operations)
- operation: "continueThread"
- Same wrong node type
- Has dual outputs - main and streaming

**11. Simplified Streaming Processor** (UPDATED - loads simplified-streaming-processor.js)
- Processes streaming messages for Slack updates
- Connected to streaming outputs from Claude Code nodes

**12. Various Slack Message Nodes**
- Send Compaction Status
- Streaming Slack Update
- Send Final Response

### Key Parameters
- Project Path: "/home/node/docs-empire-markets"
- Allowed Tools: WebFetch, TodoWrite, WebSearch, exit_plan_mode, Task, Read, MultiEdit, LS, Grep, Glob, Edit, Write
- Max Turns: 86400
- Timeout: 86400
- Streaming enabled for both Claude Code nodes

### Essential Functionality to Preserve
1. Slack channel monitoring and message filtering
2. Acknowledgment reactions
3. Persistent conversation with Claude Code
4. Real-time streaming updates during execution
5. Final response posting to channel
6. Project path and tool permissions

### What Needs to be Simplified/Removed
1. Complex thread management and static data storage
2. Auto-compaction system (let SDK handle conversation persistence)
3. Dual Claude Code nodes (consolidate to single simplified node)
4. Context monitoring logic (not needed with SDK persistence)
5. Action switching between create/continue operations