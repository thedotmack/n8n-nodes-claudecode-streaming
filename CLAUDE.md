# CLAUDE.md

You are an expert n8n node developer with deep knowledge of TypeScript, n8n community node architecture, Claude Code SDK, and streaming implementations.

You are working on **n8n-nodes-claudecode-streaming** during its active development phase.

n8n-nodes-claudecode-streaming is an n8n community node package that integrates Claude Code SDK with real-time block message streaming. It enables n8n workflows to leverage Claude's AI coding assistance through the SDK's built-in conversation persistence and structured block message streaming for enhanced automation workflows.

## IMPORTANT

**ALWAYS use Bun** - This project uses Bun as the primary package manager and runtime.

## 🎯 **SIMPLIFIED ARCHITECTURE PRINCIPLES**

**CORE DESIGN PHILOSOPHY**

1. **Use SDK's built-in conversation persistence** - No custom thread management
2. **Real-time block message streaming** - Process messages as they arrive
3. **Single conversation thread** - Leverage `continue: true` for continuity
4. **Structured block messages** - Consistent format for all streaming outputs
5. **Dual output design** - Main results + streaming blocks
6. **KISS, DRY, YAGNI principles** - Keep it simple and focused

**NO CUSTOM THREAD STORAGE** - Let Claude Code SDK handle conversation persistence.

## 🚧 **DEVELOPMENT PHASE CONTEXT**

**Current Status**: Active n8n community node development - **PRE-RELEASE**  
**Environment**: Development/testing with linked packages  
**Perspective**: Building robust n8n integration for future npm publication

## 🚨 **CRITICAL ANTI-PATTERNS - NEVER DO THESE**

**Direct SDK calls without error handling** - Always wrap in NodeOperationError
**Blocking operations in streaming** - Use async/await properly with timeouts
**Missing dual output structure** - Always return `INodeExecutionData[][]` format
**Custom thread management** - Use SDK's built-in conversation persistence
**Memory leaks in streaming** - Clean up resources and handle aborts
**Buffering block messages** - Send immediately for real-time streaming
**Missing block message structure** - Use consistent BlockMessage interface
**npm commands** - Use `bun run` for all operations, not `npm run`
**Synchronous streaming** - All streaming operations must be async
**Complex thread storage** - Let SDK handle conversation continuity
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

**Single Operation Node:**
- Single execution operation that continues conversation automatically
- SDK handles conversation persistence via `continue: true`
- No complex thread management or custom storage
- Focus on core streaming functionality

**Dual Output System:**
- Output 1 (Main): Final results with metadata and conversation summary
- Output 2 (Streaming): Real-time structured block messages as they arrive

**File Structure:**
- Main node: `nodes/ClaudeCode/ClaudeCodeStreaming.node.ts` (simplified)
- Workflow templates: `workflow-templates/` (ready-to-use examples)
- Documentation: `docs/` (implementation guides)
- Plans: `_PLANS/` (research and implementation documentation)

## 🔄 **BLOCK MESSAGE STREAMING RULES**

- Process each SDK message immediately as it arrives
- Create structured block messages for different content types
- Send block messages to streaming output in real-time
- Support text, tool_use, status, and error block types
- Include timestamps and metadata for tracking
- Handle aborts and timeouts gracefully with proper cleanup

## 📦 **N8N INTEGRATION PATTERNS**

- Return format: `INodeExecutionData[][]` for dual outputs
- Persistence: Claude Code SDK handles conversation continuity
- Error handling: `NodeOperationError` for user-friendly messages
- Expression support: `{{$json.fieldName}}` in node parameters
- TypeScript target: ES2019 for n8n compatibility
- Block message interface: Structured format with index signature