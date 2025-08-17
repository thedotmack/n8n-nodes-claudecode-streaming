# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Common Commands

### Development
- `bun run dev` - Run TypeScript compiler in watch mode for development
- `bun run build` - Build the project (clean dist, compile TypeScript with bunx, copy icons with gulp)
- `bun run format` - Format code using Prettier
- `bun run lint` - Run ESLint to check code quality
- `bun run lintfix` - Auto-fix linting issues where possible

### n8n Integration
- Install locally: `npm link` then `n8n start` to test the node
- The node appears in n8n UI under "Claude Code" category
- Debug output available when Debug option is enabled in node parameters

## Architecture Overview

This is an n8n community node that integrates Claude Code SDK with streaming capabilities and thread management. The architecture consists of:

1. **Main Node Implementation** (`nodes/ClaudeCode/ClaudeCodeStreaming.node.ts`)
   - Implements `INodeType` interface from n8n
   - Provides Create, Update, Get, and Get Many operations for conversation threads
   - Handles Claude Code SDK initialization and message processing
   - Manages tool availability and project path configuration
   - Features dual-output system (main + streaming)

2. **Thread Management System**
   - Persistent conversation threads stored in n8n workflow static data
   - Thread operations: Create new, Update existing, Get most recent, Get all threads
   - Custom thread IDs and metadata support
   - Message history with configurable limits

3. **Tool System**
   - Dynamic tool enabling/disabling based on user configuration
   - Supports: Bash, Edit/MultiEdit, Read/Write, Web operations, Todo management, Task agents
   - MCP servers supported via Claude's native configuration system (.claude/settings.local.json)

4. **Streaming & Output Handling**
   - Dual-output architecture: main results + streaming updates
   - Multiple output formats: structured JSON, messages array, plain text, thread info
   - Real-time Slack webhook integration with configurable formats
   - Streaming output branch for workflow routing and real-time updates
   - Abort signal handling with configurable timeouts

5. **Project Path Support**
   - Configure working directory via `projectPath` parameter
   - Allows Claude Code to run in specific project directories
   - Enables access to code repositories without changing n8n's working directory

## Key Development Patterns

### n8n Node Structure
- All node logic resides in `ClaudeCodeStreaming.node.ts`
- Parameters defined using n8n's declarative schema with conditional display options
- Error handling follows n8n patterns with `NodeOperationError`
- Dual-output system: main results and streaming updates
- Thread persistence using n8n workflow static data

### TypeScript Configuration
- Strict mode enabled for type safety
- Target ES2019 with CommonJS modules (n8n requirement)
- Source maps generated for debugging
- Output to `dist/` directory
- Uses Bun for faster compilation

### Code Style
- Uses tabs with width 2 (n8n standard)
- Single quotes for strings
- Semicolins required
- Maximum line width: 100 characters
- ESLint configured with n8n-nodes-base rules

### Thread Management Patterns
- Threads stored as `claude_thread_${threadId}` in static data
- Thread list maintained as `claude_threads_list` for indexing
- Auto-generated thread IDs use timestamp + random hex
- Message history pruning based on `maxThreadHistory` setting

## Testing Approach

No automated tests are configured (typical for n8n community nodes). Testing involves:
1. Building the node: `bun run build`
2. Linking locally: `npm link`
3. Starting n8n: `n8n start`
4. Creating test workflows with various parameter combinations
5. Testing thread persistence across multiple executions
6. Using Debug mode to inspect Claude Code interactions and streaming

## Configuration Examples

The `examples/` directory contains sample configurations:
- **simple-project/**: Basic setup without MCP servers
- **project-with-mcp/**: Full MCP server configuration example

Key configuration files:
- `.mcp.json`: Defines available MCP servers (project root)
- `.claude/settings.json`: Team-shared settings
- `.claude/settings.local.json`: Personal settings (gitignored)

When using Project Path, Claude Code automatically loads these configurations from the specified directory.