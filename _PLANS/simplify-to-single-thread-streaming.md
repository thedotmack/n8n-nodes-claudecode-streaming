# Simplify Node to Single Thread with Structured Block Message Streaming

## Overview
Refactor the Claude Code Streaming node from complex multi-thread management to a simplified single chat thread model with focus on structured block message streaming.

## Core Issues to Address
- Remove over-engineered thread persistence system
- Leverage Claude Code SDK's built-in conversation management 
- Implement proper structured block message streaming
- Simplify node architecture using KISS, DRY, YAGNI principles

## Todo List

### 1. Remove Complex Thread Management
- [ ] Remove custom thread storage from `this.getWorkflowStaticData('global')`
- [ ] Remove thread operations: `listThreads`, `continueThread`, `continueLast`, `newThread`
- [ ] Remove `ThreadData` interface and thread persistence logic
- [ ] Remove thread metadata management and custom history trimming

### 2. Simplify Node Operations
- [ ] Replace 4 operations with single "Execute" operation
- [ ] Remove thread ID parameters and custom thread management UI
- [ ] Simplify node parameters to focus on core functionality
- [ ] Remove thread management collections from node properties

### 3. Leverage Claude Code SDK Native Capabilities
- [ ] Use Claude Code SDK's built-in conversation persistence
- [ ] Let Claude Code handle conversation compacting automatically
- [ ] Remove custom message history management (lines 719-762)
- [ ] Trust SDK for conversation context and continuity

### 4. Implement Structured Block Message Streaming
- [ ] Design structured block message format for streaming output
- [ ] Implement block-based message parsing from Claude Code responses
- [ ] Create proper block message structure for Slack/webhook delivery
- [ ] Add block message formatting for different content types (text, code, tool use, etc.)

### 5. Simplify Streaming Architecture
- [ ] Remove complex streaming buffering and batching logic
- [ ] Focus streaming on structured block messages only
- [ ] Simplify dual output to: Main (final result) + Streaming (block messages)
- [ ] Remove legacy webhook streaming options

### 6. Clean Up Utilities
- [ ] Remove unused thread management utilities
- [ ] Keep only block message formatting utilities
- [ ] Remove complex streaming state management
- [ ] Simplify streaming processor to handle block messages

### 7. Update Documentation
- [ ] Update CLAUDE.md to reflect simplified architecture
- [ ] Remove thread persistence protocol section
- [ ] Focus documentation on block message streaming
- [ ] Update workflow templates for simplified usage

## Success Criteria
- Single operation node that starts/continues one conversation thread
- Structured block messages streaming to second output
- Claude Code SDK handles all conversation persistence
- Simplified, maintainable codebase focused on core streaming functionality