# Implementation Plan: Simplified Claude Code Streaming Node

## Overview
Implement a simplified Claude Code streaming node that leverages SDK's built-in conversation persistence and provides real-time block message streaming through n8n's dual output system.

## Implementation Strategy
Based on research findings, this implementation will:
- Remove all custom thread management complexity
- Use Claude Code SDK's native conversation persistence
- Implement real-time block message streaming to second output
- Follow established n8n patterns and best practices
- Maintain backward compatibility where possible

## Detailed Implementation Steps

### Phase 1: Node Structure Simplification
1. **Remove complex operation types and thread management UI**
   - Delete operation selection (newThread, continueThread, continueLast, listThreads)
   - Remove thread ID parameters and custom thread management collections
   - Simplify to single execution mode

2. **Update node description and metadata**
   - Change subtitle to focus on prompt instead of operation
   - Update description to emphasize streaming block messages
   - Remove operation-dependent display options

3. **Simplify parameter structure**
   - Keep core parameters: prompt, model, maxTurns, timeout, projectPath
   - Streamline allowedTools configuration
   - Replace complex streaming options with simple block streaming toggle
   - Remove thread management collections entirely

### Phase 2: Execute Function Rewrite
1. **Remove all thread management logic**
   - Delete static data storage and retrieval
   - Remove thread validation and operations handling
   - Remove custom history management and trimming
   - Delete thread list maintenance code

2. **Implement simplified query execution**
   - Use Claude Code SDK query function directly
   - Set `continue: true` for automatic conversation persistence
   - Remove custom thread ID generation and tracking
   - Simplify parameter handling

3. **Add real-time block message streaming**
   - Create BlockMessage interface for structured streaming
   - Implement createBlockMessage helper function
   - Process each SDK message immediately as it arrives
   - Send block messages to streaming output in real-time

### Phase 3: Streaming Architecture Implementation
1. **Implement block message creation logic**
   - Handle 'assistant' messages (text and tool_use content)
   - Handle 'result' messages for completion status
   - Add proper timestamp and metadata handling
   - Support different content types (text, tool_use, status, error)

2. **Update dual output handling**
   - Maintain existing dual output structure: [main, streaming]
   - Send final results to main output with metadata
   - Send real-time block messages to streaming output
   - Remove complex webhook and batching logic

3. **Add proper error handling**
   - Use NodeOperationError for user-friendly messages
   - Handle SDK timeout and abort scenarios
   - Implement continueOnFail pattern for graceful degradation
   - Add debug logging for troubleshooting

### Phase 4: Integration and Testing
1. **Update imports and dependencies**
   - Remove unused crypto import (no more thread ID generation)
   - Keep Claude Code SDK import and AbortController
   - Ensure all TypeScript types are properly defined

2. **Test streaming functionality**
   - Verify real-time block message delivery
   - Test conversation persistence across executions
   - Validate dual output format compliance
   - Check error handling scenarios

3. **Performance optimization**
   - Remove overhead from thread storage operations
   - Optimize message processing loop
   - Ensure proper memory cleanup and abort handling

### Phase 5: Documentation and Templates
1. **Update CLAUDE.md**
   - Remove thread persistence protocol section
   - Add block message streaming documentation
   - Update architecture patterns to reflect simplification
   - Remove anti-patterns related to thread management

2. **Update workflow templates**
   - Simplify node configuration examples
   - Remove thread management examples
   - Add block message streaming usage patterns
   - Update best practices guidance

## Success Criteria
- [ ] Single operation node with minimal configuration
- [ ] Real-time block messages streaming to second output
- [ ] Conversation persistence handled automatically by SDK
- [ ] No custom thread storage or management code
- [ ] Proper error handling with NodeOperationError
- [ ] Backward-compatible output format for main results
- [ ] Clean, maintainable codebase following n8n patterns

## Key Code Changes Summary

### Before (Complex)
- 4 operations (newThread, continueThread, continueLast, listThreads)
- Custom thread storage in workflow static data
- Complex streaming with webhook batching
- Thread metadata management and history trimming
- Over 800 lines of thread management logic

### After (Simplified)  
- Single execution operation
- Claude Code SDK handles conversation persistence
- Real-time block message streaming to n8n output
- No custom storage or thread management
- ~300 lines focused on core functionality

## Risk Mitigation
- Maintain existing output format for main results to preserve compatibility
- Add feature flag for block streaming to allow gradual adoption
- Preserve error handling patterns for consistent user experience
- Keep debug logging for troubleshooting during transition