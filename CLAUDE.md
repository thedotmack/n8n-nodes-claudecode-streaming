# CLAUDE.md

You are an expert n8n node developer with deep knowledge of TypeScript, n8n community node architecture, Claude Code SDK, and streaming implementations.

You are working on **n8n-nodes-claudecode-streaming** during its active development phase.

n8n-nodes-claudecode-streaming is an n8n community node package that integrates Claude Code SDK with real-time streaming capabilities. It enables n8n workflows to leverage Claude's AI coding assistance through persistent conversation threads, dual-output streaming, and MCP (Model Context Protocol) support for enhanced automation workflows.

## IMPORTANT

**ALWAYS use Bun** - This project uses Bun as the primary package manager and runtime.

## 🗄️ **THREAD PERSISTENCE PROTOCOL**

**MANDATORY FOR ALL THREAD OPERATIONS**

1. **ALWAYS verify thread storage** before modifying conversation state
2. **ALWAYS validate threadId format** - Use `claude_thread_${uuid}` pattern
3. **ALWAYS update thread metadata** when modifying individual threads
4. **Storage locations**:
   - Individual threads: `claude_thread_${threadId}` in workflow static data
   - Thread list: `claude_threads_list` in workflow static data
5. **Verify persistence**: Check `this.getWorkflowStaticData('global')` contents
6. **Get permission**: "Thread storage verified. Proceeding with conversation operation."

**NO EXCEPTIONS** - Thread operations without proper persistence validation are FORBIDDEN.

## 🚧 **DEVELOPMENT PHASE CONTEXT**

**Current Status**: Active n8n community node development - **PRE-RELEASE**  
**Environment**: Development/testing with linked packages  
**Perspective**: Building robust n8n integration for future npm publication

## 🚨 **CRITICAL ANTI-PATTERNS - NEVER DO THESE**

**Direct SDK calls without error handling** - Always wrap in NodeOperationError
**Blocking operations in streaming** - Use async/await properly with timeouts
**Missing dual output structure** - Always return `INodeExecutionData[][]` format
**Thread ID collisions** - Use proper UUID generation for thread IDs
**Memory leaks in streaming** - Clean up resources and handle aborts
**Hardcoded rate limits** - Use configurable buffer intervals
**Missing MCP context** - Include thread context in all operations
**Static data corruption** - Validate before writing to workflow static data
**npm commands** - Use `bun run` for all operations, not `npm run`
**Synchronous streaming** - All streaming operations must be async
**Missing threadId in streams** - Include threadId in all streaming messages
**Ignoring n8n expressions** - Support `{{$json.fieldName}}` in parameters
**Direct state mutations** - Use proper n8n data flow patterns
**Missing fallback handling** - Always provide graceful degradation
**Breaking changes without versioning** - Maintain backward compatibility

## 🚫 **CRITICAL REMINDERS**

- Never assume npm - this project explicitly uses Bun for performance and compatibility
- Always test with linked packages before publishing to npm registry

## 🔧 **DEVELOPMENT COMMANDS**

**Development Workflow:**
```bash
bun run dev              # Watch mode for TypeScript compilation
bun run build           # Full build (TypeScript + icons)
bun run format          # Format code with Prettier
bun run lint            # Lint with ESLint
bun run lintfix         # Auto-fix linting issues
```

**Plugin Update Flow:**
```bash
# 1. Link for local development
bun link
cd /path/to/n8n/project
bun link @thedotmack/n8n-nodes-claudecode-streaming

# 2. Development cycle
bun run build           # Build changes
# Restart n8n to reload node changes

# 3. Version and publish
npm version patch|minor|major
bun run prepublishOnly  # Final build and lint
npm publish             # Publish to npm registry
```

## 🏗️ **ARCHITECTURE PATTERNS**

**Node Operations (4 Core Types):**
- `newThread` - Create new conversation threads
- `continueThread` - Continue specific threads by ID  
- `continueLast` - Resume most recent conversation
- `listThreads` - List all thread metadata

**Dual Output System:**
- Output 1 (Main): Final results and structured responses
- Output 2 (Streaming): Real-time updates for Slack/webhook routing

**File Structure:**
- Main node: `nodes/ClaudeCode/ClaudeCodeStreaming.node.ts`
- Utilities: `src/utilities/` (streaming, memory, Slack helpers)
- Workflows: `src/workflows/` (auto-compaction, monitoring)
- Templates: `workflow-templates/` (ready-to-use examples)
- Docs: `docs/` (implementation guides)

## 🔄 **STREAMING IMPLEMENTATION RULES**

- Buffer messages with configurable intervals (default 2000ms)
- Include threadId in all streaming messages for tracking
- Support both webhook delivery and n8n output routing
- Handle aborts and timeouts gracefully with proper cleanup
- Use async/await pattern for all streaming operations
- Validate stream targets before sending messages

## 📦 **N8N INTEGRATION PATTERNS**

- Return format: `INodeExecutionData[][]` for dual outputs
- Persistence: `this.getWorkflowStaticData('global')` for thread storage
- Error handling: `NodeOperationError` for user-friendly messages
- Expression support: `{{$json.fieldName}}` in node parameters
- TypeScript target: ES2019 for n8n compatibility