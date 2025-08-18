# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is an n8n community node package that integrates Claude Code SDK with streaming capabilities. It allows n8n workflows to leverage Claude's AI coding assistance with persistent conversation threads, real-time streaming, and MCP (Model Context Protocol) support.

**Key Technologies:**
- n8n community node architecture
- TypeScript for type-safe development
- Claude Code SDK (`@anthropic-ai/claude-code`)
- Bun as the primary runtime and package manager
- Gulp for build pipeline

**Primary Node:** `ClaudeCodeStreaming` - Provides AI coding assistance with dual outputs (main results + streaming updates)

## Architecture Overview

### Core Components
- **Main Node**: `nodes/ClaudeCode/ClaudeCodeStreaming.node.ts` - The primary n8n node implementation
- **Utilities**: `src/utilities/` - Streaming processors, memory management, and Slack integration helpers
- **Workflows**: `src/workflows/` - Auto-compaction and context monitoring utilities  
- **Templates**: `workflow-templates/` - Ready-to-use n8n workflow examples
- **Documentation**: `docs/` - Implementation guides for streaming, Block Kit, and validation

### Node Architecture
The main node supports four operations:
1. **Create** (`newThread`) - Start new conversation threads
2. **Update** (`continueThread`) - Continue specific threads by ID
3. **Get** (`continueLast`) - Resume most recent conversation
4. **Get Many** (`listThreads`) - List all thread metadata

**Dual Output System:**
- Output 1 (Main): Final results and structured responses
- Output 2 (Streaming): Real-time updates for routing to Slack/webhooks

### Thread Persistence
Conversations are persisted in n8n's static data using:
- Individual thread storage: `claude_thread_${threadId}`
- Thread list metadata: `claude_threads_list`
- Automatic history trimming and sorting by recency

## Important Commands

### Development
```bash
bun run dev              # Watch mode for TypeScript compilation
bun run build           # Full build (TypeScript + icons)
bun run format          # Format code with Prettier
bun run lint            # Lint with ESLint
bun run lintfix         # Auto-fix linting issues
```

### Publishing
```bash
bun run prepublishOnly  # Build and lint before publishing
```

**Note:** This project uses Bun as the primary package manager. All commands should be run with `bun run` rather than `npm run`.

## Plugin Update Flow

When implementing new features or bug fixes for this n8n node:

### 1. Local Development (Linked Package)
```bash
# Link the package locally for development
bun link                   # Register this package for linking
cd /path/to/n8n/project   # Navigate to your n8n instance
bun link @thedotmack/n8n-nodes-claudecode-streaming  # Link the package

# Development workflow
bun run build             # Build changes
# n8n will automatically use the linked version
# Restart n8n to reload node changes
```

**Note:** npm registry errors (404, CORS) in browser console are expected for linked packages and can be ignored. The config error may indicate a separate issue with node initialization.

### 2. Version and Publish
```bash
# Update version in package.json
npm version patch|minor|major
bun run prepublishOnly    # Final build and lint
npm publish              # Publish to npm registry
```

### 3. Update in n8n
```bash
# In n8n installation directory
npm update @thedotmack/n8n-nodes-claudecode-streaming
# Restart n8n instance
```

### 4. Workflow Updates
If the node interface changes:
- Update workflow templates in `workflow-templates/`
- Update documentation in `docs/`
- Test workflows in `workflows/production/`

## Development Guidelines

### TypeScript Configuration
- Strict type checking enabled
- Target ES2019 for n8n compatibility  
- Declaration files generated for IDE support
- Source maps enabled for debugging

### Node Development Patterns
- Use n8n's `INodeExecutionData[][]` return format for dual outputs
- Store persistent data in `this.getWorkflowStaticData('global')`
- Handle errors with `NodeOperationError` for user-friendly messages
- Support expressions like `{{$json.fieldName}}` in node parameters

### Streaming Implementation
- Buffer messages to respect rate limits (default 2000ms intervals)
- Support both webhook delivery and output routing
- Include threadId in all streaming messages for tracking
- Handle aborts and timeouts gracefully

### File Structure Conventions
- Node implementations: `nodes/[NodeName]/[NodeName].node.ts`
- Utilities: `src/utilities/` (reusable functions)
- Workflows: `src/workflows/` (workflow-specific logic)
- Examples: `examples/` and `workflow-templates/`
- Documentation: `docs/` (implementation guides)