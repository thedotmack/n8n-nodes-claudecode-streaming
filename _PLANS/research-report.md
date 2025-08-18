# Research Report: Simplified Claude Code Streaming Node Implementation

## Executive Summary

This research provides comprehensive findings on implementing a simplified n8n node for Claude Code streaming with proper block message structure and real-time output capabilities.

## Key Findings

### 1. Claude Code SDK Streaming Patterns

**TypeScript SDK Pattern (Recommended)**:
```typescript
import { query } from "@anthropic-ai/claude-code";

for await (const message of query({
  prompt: "Analyze system performance",
  abortController: new AbortController(),
  options: {
    maxTurns: 5,
    systemPrompt: "You are a performance engineer",
    continue: true, // Enables conversation persistence
  }
})) {
  // Process streamed messages in real-time
  if (message.type === "result") {
    console.log(message.result);
  }
}
```

**Message Types from SDK**:
- `user` - User input messages
- `assistant` - Claude's responses with content blocks
- `system` - System initialization 
- `result` - Final result with metadata (cost, duration, etc.)
- `tool_use` - Tool execution messages

**Built-in Conversation Persistence**:
- Claude Code SDK handles conversation context automatically
- Use `continue: true` option to maintain conversation threads
- No need for custom thread storage - SDK manages this internally

### 2. n8n Multiple Output Patterns

**Switch Node Analysis**:
- Uses dynamic output configuration via `numberOutputs` parameter
- Returns `INodeExecutionData[][]` format (array of arrays)
- Each sub-array represents data for a specific output branch
- Supports dynamic output naming and routing

**Recommended n8n Output Structure**:
```typescript
// Return format for dual outputs
return [
  returnData,      // Output 1: Final results
  streamingData    // Output 2: Real-time streaming blocks
];
```

### 3. Real-Time Block Message Streaming

**Anthropic API Streaming Events**:
- `message_start` - Begin conversation
- `content_block_start` - Start of content block (text/tool_use)
- `content_block_delta` - Incremental content updates
- `content_block_stop` - End of content block
- `message_stop` - End of message

**Block Message Structure for n8n**:
```typescript
interface BlockMessage {
  type: 'text' | 'tool_use' | 'tool_result' | 'status' | 'error';
  content: string;
  timestamp: string;
  metadata?: {
    tool_name?: string;
    block_index?: number;
    message_id?: string;
  };
}
```

### 4. n8n Node Development Best Practices

**Node Structure Patterns (from existing implementations)**:
```typescript
// Standard n8n node implementation pattern
export class ClaudeCodeStreaming implements INodeType {
  description: INodeTypeDescription = {
    displayName: 'Claude Code Streaming',
    name: 'claudeCodeStreaming',
    group: ['transform'],
    version: 1,
    description: 'AI coding assistant with streaming block messages',
    defaults: { name: 'Claude Code Streaming' },
    inputs: [{ type: NodeConnectionType.Main }],
    outputs: [
      { type: NodeConnectionType.Main, displayName: 'Main' },
      { type: NodeConnectionType.Main, displayName: 'Streaming' }
    ],
    properties: [/* simplified parameters */]
  };

  async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
    const returnData: INodeExecutionData[] = [];
    const streamingData: INodeExecutionData[] = [];
    
    // Process each input item
    for (let itemIndex = 0; itemIndex < items.length; itemIndex++) {
      // Implementation logic
    }
    
    return [returnData, streamingData]; // Dual output format
  }
}
```

**Error Handling Patterns**:
```typescript
// Standard n8n error handling
try {
  // Node execution logic
} catch (error) {
  if (this.continueOnFail()) {
    returnData.push({
      json: { error: error.message },
      pairedItem: itemIndex,
    });
    continue;
  }
  
  throw new NodeOperationError(this.getNode(), error.message, {
    itemIndex,
    description: 'Claude Code execution failed'
  });
}
```

### 5. Existing n8n Claude Code Integration Analysis

**Current Implementation Patterns**:
- File: `nodes/ClaudeCode/ClaudeCode.node.ts` 
- Operations: Query and Continue (not complex multi-threading)
- Parameters: Simple structure with operation, prompt, projectPath, model
- Tools: Configurable allowedTools array
- Output: Multiple formats supported (structured, messages, text)

**Key Configuration Options**:
```typescript
// From existing integration
{
  operation: "query",
  prompt: "Analyze this codebase",
  projectPath: "/path/to/project", 
  model: "sonnet" | "opus",
  allowedTools: ["Read", "Write", "Edit", "Bash"],
  additionalOptions: {
    permissionMode: "default" | "bypassPermissions",
    systemPrompt?: string,
    maxThinkingTokens?: number
  }
}
```

### 6. Simplified Architecture Recommendations

**Single Operation Node**:
- Remove complex thread management operations  
- Single "Execute" operation that continues conversation automatically
- Leverage Claude Code SDK's built-in persistence via `continue: true`

**Real-Time Streaming Implementation**:
```typescript
// Process each message as it arrives from SDK
for await (const message of query(queryOptions)) {
  // Immediately create and send block message
  const blockMessage = createBlockMessage(message);
  if (blockMessage) {
    streamingData.push({
      json: blockMessage,
      pairedItem: itemIndex
    });
  }
  
  // Collect for final output
  messages.push(message);
}

// Send final result to main output
returnData.push({
  json: {
    result: finalResult,
    messages: messages,
    metadata: { duration, cost, turns }
  },
  pairedItem: itemIndex
});
```

**Block Message Creation**:
```typescript
const createBlockMessage = (message: SDKMessage): BlockMessage | null => {
  switch (message.type) {
    case 'assistant':
      if (message.message?.content) {
        const content = message.message.content[0];
        if (content.type === 'text') {
          return {
            type: 'text',
            content: content.text,
            timestamp: new Date().toISOString(),
            metadata: { messageId: message.id }
          };
        } else if (content.type === 'tool_use') {
          return {
            type: 'tool_use', 
            content: `Using tool: ${content.name}`,
            timestamp: new Date().toISOString(),
            metadata: { 
              tool_name: content.name,
              tool_input: content.input 
            }
          };
        }
      }
      break;
    case 'result':
      return {
        type: 'status',
        content: 'Execution completed',
        timestamp: new Date().toISOString(),
        metadata: {
          success: message.subtype === 'success',
          duration: message.duration_ms,
          cost: message.total_cost_usd
        }
      };
  }
  return null;
};
```

## Implementation Plan

### Phase 1: Node Structure Simplification
1. Remove all thread management operations and parameters
2. Implement single "Execute" operation
3. Simplify parameter structure to core functionality
4. Remove custom thread storage logic

### Phase 2: SDK Integration
1. Use Claude Code SDK's native conversation persistence
2. Implement proper query options structure
3. Add `continue: true` for automatic conversation management
4. Remove custom history management

### Phase 3: Real-Time Block Streaming
1. Implement block message interface
2. Create real-time streaming handler for SDK messages
3. Route block messages to second output immediately as they arrive
4. Structure main output for final results with metadata

### Phase 4: Output Optimization
1. Simplify dual output to: Main (final) + Streaming (blocks)
2. Remove complex webhook and batching logic
3. Focus on n8n native routing capabilities
4. Implement proper error handling and timeouts

## Success Metrics

1. **Simplicity**: Single operation node with minimal parameters
2. **Real-time**: Block messages appear in streaming output as they arrive
3. **Persistence**: Conversation continues automatically via SDK
4. **Performance**: No custom thread storage overhead
5. **Maintainability**: Clean codebase following n8n and SDK patterns

## Next Steps

1. Complete research on n8n execution patterns and error handling
2. Examine existing n8n Claude Code integrations for best practices
3. Implement prototype following research findings
4. Test real-time streaming performance and reliability