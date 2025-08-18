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

## Available MCP Tools

This project has access to powerful MCP (Model Context Protocol) tools that enhance development capabilities:

### n8n MCP Server
Access comprehensive n8n node documentation and configuration assistance:
- **Node Discovery**: Search and list n8n nodes by category, functionality, or keyword
- **Configuration Help**: Get detailed property information and validation for any n8n node
- **Template Access**: Browse and retrieve pre-built workflow templates
- **Validation Tools**: Validate node configurations and complete workflows before deployment

Example usage patterns:
```javascript
// Find nodes for your use case
search_nodes({query: "claude"}) // Find Claude-related nodes
list_ai_tools() // List all AI-capable nodes
get_node_essentials("nodes-base.slack") // Get essential Slack node properties

// Validate configurations
validate_node_operation("@thedotmack/n8n-nodes-claudecode-streaming.claudeCodeStreaming", config)
validate_workflow(workflowJson) // Validate entire workflow structure
```

### Context7 Documentation Server
Access up-to-date documentation for any library or framework:
- **Library Resolution**: Automatically find the correct documentation source
- **Focused Documentation**: Retrieve documentation filtered by topic or functionality
- **Code Examples**: Access comprehensive code snippets and usage patterns

Example usage:
```javascript
// Get n8n documentation
resolve_library_id("n8n") // Find available n8n documentation sources
get_library_docs("/n8n-io/n8n", {topic: "community nodes"}) // Get specific documentation

// Access workflow examples
get_library_docs("/enescingoz/awesome-n8n-templates") // Get template examples
```

### Development Workflow with MCP Tools

1. **Node Research**: Use n8n MCP to understand available nodes and their capabilities
2. **Configuration**: Get detailed parameter information and validation
3. **Documentation**: Use Context7 to access current best practices and examples
4. **Validation**: Validate your node configurations before testing
5. **Templates**: Access pre-built workflows for common patterns

## Configuration Examples

The `examples/` directory contains sample configurations:
- **simple-project/**: Basic setup without MCP servers
- **project-with-mcp/**: Full MCP server configuration example

Key configuration files:
- `.mcp.json`: Defines available MCP servers (project root)
- `.claude/settings.json`: Team-shared settings
- `.claude/settings.local.json`: Personal settings (gitignored)

When using Project Path, Claude Code automatically loads these configurations from the specified directory.

## Opinionated Development Guidance

Based on the architecture and patterns established in this codebase:

### Workflow Design Philosophy
- **External Code Organization**: Keep complex logic in external `.js` files (like `src/workflows/context-monitor.js`, `src/workflows/auto-compaction-manager.js`) rather than inline in n8n Code nodes. This enables better version control, testing, and maintainability.
- **Modular Functions**: Each external file should export a single primary function that can be loaded via `eval(require('fs').readFileSync(path))` pattern.
- **Static Data as Persistence**: Use n8n workflow static data as the primary persistence layer for thread management and context tracking rather than external databases.

### Thread Management Best Practices
- **Persistent Thread IDs**: Use consistent, meaningful thread IDs (like 'tom-docs') rather than dynamic channel-based IDs for persistent conversations.
- **Context Thresholds**: Implement smart auto-compaction with clear thresholds (100 messages, 50k characters) to prevent context overflow.
- **Memory Segments**: Store conversation summaries as structured memory segments with metadata for intelligent context retrieval.

### Streaming Architecture Patterns
- **Dual Output Design**: Always implement both main result output and streaming output for real-time user feedback.
- **Smart Filtering**: Reduce streaming noise with intelligent filtering (e.g., every 8th message, time gaps >5 seconds) for collaborative contexts.
- **Block Kit Integration**: Use Slack Block Kit for rich, structured status updates that provide clear progress indication.

### Error Handling and Resilience
- **Graceful Degradation**: Include fallback mechanisms in auto-compaction and summarization processes.
- **Continue on Error**: Use `onError: "continueRegularOutput"` for non-critical nodes to maintain workflow stability.
- **Timeout Management**: Set reasonable timeouts (86400s for long-running Claude Code operations) with proper abort signal handling.

### Development Anti-Patterns to Avoid
- **Inline Complex Logic**: Don't embed complex business logic directly in n8n Code nodes - externalize it.
- **Dynamic Channel Routing**: Avoid using dynamic channel IDs that can result in "undefined" values - use hardcoded constants where appropriate.
- **Excessive Streaming**: Don't stream every single message update - implement smart filtering to reduce noise.
- **Memory Bloat**: Don't accumulate unlimited conversation history - implement auto-compaction and memory management.