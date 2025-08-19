import type {
	IExecuteFunctions,
	INodeExecutionData,
	INodeType,
	INodeTypeDescription,
} from 'n8n-workflow';
import { NodeConnectionType, NodeOperationError } from 'n8n-workflow';
import { query, type SDKMessage } from '@anthropic-ai/claude-code';

// Interface for structured block messages
interface BlockMessage {
	type: 'text' | 'code' | 'tool_use' | 'tool_result' | 'error' | 'status';
	content: string;
	timestamp: string;
	metadata?: Record<string, any>;
	[key: string]: any; // Index signature for n8n IDataObject compatibility
}

export class ClaudeCodeStreaming implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'Claude Code Streaming',
		name: 'claudeCodeStreaming',
		icon: 'file:claudecode.svg',
		group: ['transform'],
		version: 1,
		subtitle: '={{$parameter["prompt"]}}',
		description:
			'AI coding assistant with block message output. Features single conversation thread with structured message output delivered after completion.',
		defaults: {
			name: 'Claude Code Streaming',
		},
		inputs: [{ type: NodeConnectionType.Main }],
		outputs: [
			{ type: NodeConnectionType.Main, displayName: 'Main' },
			{ type: NodeConnectionType.Main, displayName: 'Block Messages' }
		],
		properties: [
			{
				displayName: 'Prompt',
				name: 'prompt',
				type: 'string',
				typeOptions: {
					rows: 4,
				},
				default: '',
				description: 'The prompt or instruction to send to Claude Code',
				required: true,
				placeholder: 'e.g., "Create a Python function to parse CSV files"',
				hint: 'Use expressions like {{$json.prompt}} to use data from previous nodes',
			},
			{
				displayName: 'Model',
				name: 'model',
				type: 'options',
				options: [
					{
						name: 'Sonnet',
						value: 'sonnet',
						description: 'Fast and efficient model for most tasks',
					},
					{
						name: 'Opus',
						value: 'opus',
						description: 'Most capable model for complex tasks',
					},
				],
				default: 'sonnet',
				description: 'Claude model to use',
			},
			{
				displayName: 'Max Turns',
				name: 'maxTurns',
				type: 'number',
				default: 10,
				description: 'Maximum number of conversation turns (back-and-forth exchanges) allowed',
			},
			{
				displayName: 'Timeout',
				name: 'timeout',
				type: 'number',
				default: 300,
				description: 'Maximum time to wait for completion (in seconds) before aborting',
			},
			{
				displayName: 'Project Path',
				name: 'projectPath',
				type: 'string',
				default: '',
				description:
					'The directory path where Claude Code should run (e.g., /path/to/project). If empty, uses the current working directory.',
				placeholder: 'e.g., /home/user/projects/my-app',
				hint: 'This sets the working directory for Claude Code, allowing it to access files and run commands in the specified project location',
			},
			{
				displayName: 'Output Format',
				name: 'outputFormat',
				type: 'options',
				noDataExpression: true,
				options: [
					{
						name: 'Structured',
						value: 'structured',
						description: 'Returns a structured object with messages, summary, result, and metrics',
					},
					{
						name: 'Messages',
						value: 'messages',
						description: 'Returns the raw array of all messages exchanged',
					},
					{
						name: 'Text',
						value: 'text',
						description: 'Returns only the final result text',
					},
				],
				default: 'structured',
				description: 'Choose how to format the output data',
			},
			{
				displayName: 'Simplify',
				name: 'simplify',
				type: 'boolean',
				default: false,
				description: 'Whether to return a simplified version of the response instead of the raw data',
				displayOptions: {
					show: {
						outputFormat: ['structured'],
					},
				},
			},
			{
				displayName: 'Allowed Tools',
				name: 'allowedTools',
				type: 'multiOptions',
				options: [
					// Built-in Claude Code tools
					{ name: 'Bash', value: 'Bash', description: 'Execute bash commands' },
					{ name: 'Edit', value: 'Edit', description: 'Edit files' },
					{ name: 'Exit Plan Mode', value: 'exit_plan_mode', description: 'Exit planning mode' },
					{ name: 'Glob', value: 'Glob', description: 'Find files by pattern' },
					{ name: 'Grep', value: 'Grep', description: 'Search file contents' },
					{ name: 'LS', value: 'LS', description: 'List directory contents' },
					{ name: 'MultiEdit', value: 'MultiEdit', description: 'Make multiple edits' },
					{ name: 'Notebook Edit', value: 'NotebookEdit', description: 'Edit Jupyter notebooks' },
					{ name: 'Notebook Read', value: 'NotebookRead', description: 'Read Jupyter notebooks' },
					{ name: 'Read', value: 'Read', description: 'Read file contents' },
					{ name: 'Task', value: 'Task', description: 'Launch agents for complex searches' },
					{ name: 'Todo Write', value: 'TodoWrite', description: 'Manage todo lists' },
					{ name: 'Web Fetch', value: 'WebFetch', description: 'Fetch web content' },
					{ name: 'Web Search', value: 'WebSearch', description: 'Search the web' },
					{ name: 'Write', value: 'Write', description: 'Write files' },
				],
				default: ['WebFetch', 'TodoWrite', 'WebSearch', 'exit_plan_mode', 'Task'],
				description: 'Select which built-in tools Claude Code is allowed to use during execution',
			},
			{
				displayName: 'Block Message Options',
				name: 'streamingOptions',
				type: 'collection',
				placeholder: 'Add Block Message Option',
				default: {},
				options: [
					{
						displayName: 'Enable Block Messages',
						name: 'enableStreaming',
						type: 'boolean',
						default: true,
						description: 'Whether to output structured block messages through the second output (delivered after completion)',
					},
					{
						displayName: 'Include Timestamps',
						name: 'includeTimestamps',
						type: 'boolean',
						default: true,
						description: 'Whether to include timestamps in block messages',
					},
				],
			},
			{
				displayName: 'MCP Configuration',
				name: 'mcpConfiguration',
				type: 'collection',
				placeholder: 'Add MCP Option',
				default: {},
				options: [
					{
						displayName: 'Enable MCP',
						name: 'enableMCP',
						type: 'boolean',
						default: true,
						description: 'Whether to enable Model Context Protocol (MCP) server integration. When enabled without explicit configuration, uses system default MCP servers.',
					},
					{
						displayName: 'Config File Path',
						name: 'mcpConfigPath',
						type: 'string',
						default: '',
						description: 'Path to MCP configuration file (JSON or YAML). Example: ./mcp-config.JSON.',
						placeholder: 'e.g., /path/to/mcp-config.json',
						displayOptions: {
							show: {
								enableMCP: [true],
							},
						},
					},
					{
						displayName: 'MCP Servers',
						name: 'mcpServers',
						type: 'fixedCollection',
						typeOptions: {
							multipleValues: true,
						},
						default: {},
						description: 'Individual MCP server configurations',
						displayOptions: {
							show: {
								enableMCP: [true],
							},
						},
						options: [
							{
								displayName: 'Server',
								name: 'server',
								values: [
									{
										displayName: 'Server Name',
										name: 'name',
										type: 'string',
										default: '',
										description: 'Name identifier for the MCP server',
										placeholder: 'e.g., n8n-mcp',
									},
									{
										displayName: 'Command',
										name: 'command',
										type: 'string',
										default: '',
										description: 'Command to start the MCP server',
										placeholder: 'e.g., npx @n8n-mcp/server',
									},
									{
										displayName: 'Arguments',
										name: 'args',
										type: 'string',
										typeOptions: {
											rows: 2,
										},
										default: '',
										description: 'Command line arguments (JSON array format)',
										placeholder: 'e.g., ["--api-key", "your-key", "--url", "https://n8n.example.com"]',
									},
									{
										displayName: 'Permission',
										name: 'permission',
										type: 'options',
										options: [
											{
												name: 'Allow All',
												value: 'whitelist',
												description: 'Allow all tools from this server',
											},
											{
												name: 'Ask Each Time',
												value: 'ask',
												description: 'Prompt for permission on each tool use',
											},
											{
												name: 'Deny All',
												value: 'blacklist',
												description: 'Block all tools from this server',
											},
										],
										default: 'ask',
										description: 'Permission level for this MCP server',
									},
								],
							},
						],
					},
				],
			},
			{
				displayName: 'Additional Options',
				name: 'additionalOptions',
				type: 'collection',
				placeholder: 'Add Option',
				default: {},
				options: [
					{
						displayName: 'System Prompt',
						name: 'systemPrompt',
						type: 'string',
						typeOptions: {
							rows: 4,
						},
						default: '',
						description: 'Additional context or instructions for Claude Code',
						placeholder:
							'e.g., You are helping with a Python project. Focus on clean, readable code with proper error handling.',
					},
					{
						displayName: 'Require Permissions',
						name: 'requirePermissions',
						type: 'boolean',
						default: false,
						description: 'Whether to require permission for tool use',
					},
					{
						displayName: 'Debug Mode',
						name: 'debug',
						type: 'boolean',
						default: false,
						description: 'Whether to enable debug logging',
					},
				],
			},
		],
	};


	async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
		const items = this.getInputData();
		const returnData: INodeExecutionData[] = [];
		const streamingData: INodeExecutionData[] = [];

		for (let itemIndex = 0; itemIndex < items.length; itemIndex++) {
			try {
				const prompt = this.getNodeParameter('prompt', itemIndex) as string;
				const model = this.getNodeParameter('model', itemIndex) as string;
				const maxTurns = this.getNodeParameter('maxTurns', itemIndex) as number;
				const timeout = this.getNodeParameter('timeout', itemIndex) as number;
				const projectPath = this.getNodeParameter('projectPath', itemIndex) as string;
				const outputFormat = this.getNodeParameter('outputFormat', itemIndex) as string;
				const simplify = this.getNodeParameter('simplify', itemIndex, false) as boolean;
				const allowedTools = this.getNodeParameter('allowedTools', itemIndex, []) as string[];
				const streamingOptions = this.getNodeParameter('streamingOptions', itemIndex) as {
					enableStreaming?: boolean;
					includeTimestamps?: boolean;
				};
				const additionalOptions = this.getNodeParameter('additionalOptions', itemIndex) as {
					systemPrompt?: string;
					requirePermissions?: boolean;
					debug?: boolean;
				};
				const mcpConfiguration = this.getNodeParameter('mcpConfiguration', itemIndex) as {
					enableMCP?: boolean;
					mcpConfigPath?: string;
					mcpServers?: {
						server: Array<{
							name: string;
							command: string;
							args: string;
							permission: 'whitelist' | 'ask' | 'blacklist';
						}>;
					};
				};

				// Create abort controller for timeout
				const abortController = new AbortController();
				const timeoutMs = timeout * 1000;
				const timeoutId = setTimeout(() => abortController.abort(), timeoutMs);

				// Validate required parameters
				if (!prompt || prompt.trim() === '') {
					throw new NodeOperationError(this.getNode(), 'Prompt is required and cannot be empty', {
						itemIndex,
					});
				}

				// Validate MCP configuration
				if (mcpConfiguration.enableMCP) {
					// Only validate if explicit configuration is provided
					if (mcpConfiguration.mcpConfigPath || mcpConfiguration.mcpServers?.server?.length) {
						if (mcpConfiguration.mcpConfigPath && mcpConfiguration.mcpServers?.server?.length) {
							throw new NodeOperationError(this.getNode(), 'Cannot specify both MCP config file path and inline MCP servers. Choose one option.', {
								itemIndex,
							});
						}
					}
					// If no explicit configuration is provided, SDK will use system default MCP servers

					// Validate inline MCP server configurations
					if (mcpConfiguration.mcpServers?.server) {
						for (const server of mcpConfiguration.mcpServers.server) {
							if (!server.name || !server.command) {
								throw new NodeOperationError(this.getNode(), 'MCP server configuration requires both name and command fields', {
									itemIndex,
								});
							}
							
							// Validate JSON format for args if provided
							if (server.args && server.args.trim()) {
								try {
									JSON.parse(server.args);
								} catch (error) {
									throw new NodeOperationError(this.getNode(), `Invalid JSON format in MCP server "${server.name}" arguments: ${server.args}`, {
										itemIndex,
									});
								}
							}
						}
					}
				}

				// Debug logging
				if (additionalOptions.debug) {
					console.log(`[ClaudeCodeStreaming] Starting execution for item ${itemIndex}`);
					console.log(`[ClaudeCodeStreaming] Prompt: ${prompt.substring(0, 100)}...`);
					console.log(`[ClaudeCodeStreaming] Model: ${model}`);
					console.log(`[ClaudeCodeStreaming] Streaming enabled: ${streamingOptions.enableStreaming}`);
					console.log(`[ClaudeCodeStreaming] MCP enabled: ${mcpConfiguration.enableMCP}`);
					if (mcpConfiguration.enableMCP) {
						if (mcpConfiguration.mcpConfigPath) {
							console.log(`[ClaudeCodeStreaming] MCP config file: ${mcpConfiguration.mcpConfigPath}`);
						} else if (mcpConfiguration.mcpServers?.server?.length) {
							console.log(`[ClaudeCodeStreaming] MCP servers configured: ${mcpConfiguration.mcpServers.server.length}`);
							mcpConfiguration.mcpServers.server.forEach((server, index) => {
								console.log(`[ClaudeCodeStreaming] MCP Server ${index + 1}: ${server.name} (${server.command}) - Permission: ${server.permission}`);
							});
						} else {
							console.log(`[ClaudeCodeStreaming] MCP using system default configuration`);
						}
					}
				}

				// Get original message context for real-time streaming (reserved for future use)
				// const originalContext = items[itemIndex].json || {};

				// Helper function to convert SDK messages to block messages
				const createBlockMessage = (type: BlockMessage['type'], content: string, metadata?: Record<string, any>): BlockMessage => {
					return {
						type,
						content,
						timestamp: streamingOptions.includeTimestamps !== false ? new Date().toISOString() : '',
						metadata: metadata || {},
					};
				};

				// Process MCP configuration
				let mcpOptions: any = {};
				if (mcpConfiguration.enableMCP) {
					// External config file takes precedence
					if (mcpConfiguration.mcpConfigPath && mcpConfiguration.mcpConfigPath.trim()) {
						mcpOptions.configFile = mcpConfiguration.mcpConfigPath.trim();
					}
					// Use inline MCP server configurations if provided
					else if (mcpConfiguration.mcpServers?.server?.length) {
						const mcpServers: Record<string, any> = {};
						const mcpServerPermissions: Record<string, string> = {};
						
						for (const server of mcpConfiguration.mcpServers.server) {
							// Parse arguments JSON array
							let parsedArgs: string[] = [];
							if (server.args && server.args.trim()) {
								parsedArgs = JSON.parse(server.args);
							}
							
							// Configure MCP server
							mcpServers[server.name] = {
								command: server.command,
								...(parsedArgs.length > 0 && { args: parsedArgs }),
							};
							
							// Set server permissions
							mcpServerPermissions[server.name] = server.permission;
						}
						
						mcpOptions.mcpServers = mcpServers;
						mcpOptions.mcpServerPermissions = mcpServerPermissions;
					}
					// If no explicit MCP configuration is provided, the SDK will automatically
					// load MCP servers from the system default configuration (e.g., ~/.claude/mcp_servers.json)
					// This allows the node to work with whatever MCP servers are already configured
				}

				// Build query options - using SDK's built-in conversation persistence
				const queryOptions = {
					prompt,
					abortController,
					options: {
						maxTurns,
						permissionMode: (additionalOptions.requirePermissions ? 'default' : 'bypassPermissions') as 'default' | 'bypassPermissions',
						model,
						continue: true, // Use SDK's conversation persistence
						outputFormat: 'stream-json', // Enable real-time streaming JSON output
						verbose: true, // Required when using stream-json output format
						...(additionalOptions.systemPrompt && { systemPrompt: additionalOptions.systemPrompt }),
						...(projectPath && projectPath.trim() && { cwd: projectPath.trim() }),
						...(allowedTools.length > 0 && { allowedTools }),
						...mcpOptions, // Include MCP configuration
					},
				};

				// Execute query
				const messages: SDKMessage[] = [];
				const startTime = Date.now();

				try {
					// Process each message as it arrives
					for await (const message of query(queryOptions)) {
						messages.push(message);

						// Create block messages if enabled
						if (streamingOptions.enableStreaming) {
							let blockMessage: BlockMessage | null = null;

							// Convert SDK message to block message
							if (message.type === 'assistant' && message.message?.content) {
								const content = message.message.content[0];
								if (content.type === 'text') {
									blockMessage = createBlockMessage('text', content.text, {
										messageId: (message as any).id,
									});
								} else if (content.type === 'tool_use') {
									blockMessage = createBlockMessage('tool_use', `Using tool: ${content.name}`, {
										tool_name: content.name,
										tool_input: content.input,
									});
								}
							} else if (message.type === 'result') {
								const resultMessage = message as any;
								blockMessage = createBlockMessage('status', 'Execution completed', {
									success: resultMessage.subtype === 'success',
									duration_ms: resultMessage.duration_ms,
									total_cost_usd: resultMessage.total_cost_usd,
								});
							}

							// Add block message to output array
							if (blockMessage) {
								streamingData.push({
									json: blockMessage,
									pairedItem: itemIndex,
								});
							}
						}

						// Debug logging
						if (additionalOptions.debug) {
							console.log(`[ClaudeCodeStreaming] Received message type: ${message.type}`);
						}
					}

					clearTimeout(timeoutId);

					const duration = Date.now() - startTime;
					if (additionalOptions.debug) {
						console.log(`[ClaudeCodeStreaming] Execution completed in ${duration}ms with ${messages.length} messages`);
					}

					// Format output based on selected format
					const resultMessage = messages.find((m) => m.type === 'result') as any;

					if (outputFormat === 'text') {
						returnData.push({
							json: {
								result: resultMessage?.result || resultMessage?.error || '',
								success: resultMessage?.subtype === 'success',
								duration_ms: resultMessage?.duration_ms,
								total_cost_usd: resultMessage?.total_cost_usd,
							},
							pairedItem: itemIndex,
						});
					} else if (outputFormat === 'messages') {
						returnData.push({
							json: {
								messages,
								messageCount: messages.length,
							},
							pairedItem: itemIndex,
						});
					} else if (outputFormat === 'structured') {
						// Parse into structured format
						const userMessages = messages.filter((m) => m.type === 'user');
						const assistantMessages = messages.filter((m) => m.type === 'assistant');
						const toolUses = messages.filter(
							(m) => m.type === 'assistant' && (m as any).message?.content?.[0]?.type === 'tool_use',
						);

						if (simplify) {
							// Simplified output with key fields
							returnData.push({
								json: {
									result: resultMessage?.result || resultMessage?.error || null,
									success: resultMessage?.subtype === 'success',
									userMessageCount: userMessages.length,
									assistantMessageCount: assistantMessages.length,
									toolUseCount: toolUses.length,
									duration_ms: resultMessage?.duration_ms || null,
									total_cost_usd: resultMessage?.total_cost_usd || null,
								},
								pairedItem: itemIndex,
							});
						} else {
							// Full structured output
							returnData.push({
								json: {
									messages,
									summary: {
										userMessageCount: userMessages.length,
										assistantMessageCount: assistantMessages.length,
										toolUseCount: toolUses.length,
										hasResult: !!resultMessage,
									},
									result: resultMessage?.result || resultMessage?.error || null,
									metrics: resultMessage ? {
										duration_ms: resultMessage.duration_ms,
										num_turns: resultMessage.num_turns,
										total_cost_usd: resultMessage.total_cost_usd,
										usage: resultMessage.usage,
									} : null,
									success: resultMessage?.subtype === 'success',
								},
								pairedItem: itemIndex,
							});
						}
					}

				} catch (queryError) {
					clearTimeout(timeoutId);

					// Send error block message if streaming enabled
					if (streamingOptions.enableStreaming) {
						const errorMessage = queryError instanceof Error ? queryError.message : 'Unknown error';
						const errorBlock = createBlockMessage('error', `Execution failed: ${errorMessage}`);
						streamingData.push({
							json: errorBlock,
							pairedItem: itemIndex,
						});
					}

					throw queryError;
				}
			} catch (error) {
				const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
				const isTimeout = error instanceof Error && error.name === 'AbortError';

				if (this.continueOnFail()) {
					returnData.push({
						json: {
							error: errorMessage,
							errorType: isTimeout ? 'timeout' : 'execution_error',
							success: false,
							timestamp: new Date().toISOString(),
						},
						pairedItem: itemIndex,
					});
					continue;
				}

				// Provide clear, user-friendly error messages
				const userFriendlyMessage = isTimeout
					? `Operation timed out. Consider increasing the timeout parameter.`
					: `Claude Code execution failed: ${errorMessage}`;

				throw new NodeOperationError(this.getNode(), userFriendlyMessage, {
					itemIndex,
					description: errorMessage,
				});
			}
		}

		return [returnData, streamingData];
	}
}