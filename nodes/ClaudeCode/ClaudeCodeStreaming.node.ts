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
			'AI coding assistant with streaming block messages. Features single conversation thread with structured message output for real-time updates.',
		defaults: {
			name: 'Claude Code Streaming',
		},
		inputs: [{ type: NodeConnectionType.Main }],
		outputs: [
			{ type: NodeConnectionType.Main, displayName: 'Main' },
			{ type: NodeConnectionType.Main, displayName: 'Streaming' }
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
				displayName: 'Streaming Options',
				name: 'streamingOptions',
				type: 'collection',
				placeholder: 'Add Streaming Option',
				default: {},
				options: [
					{
						displayName: 'Enable Block Message Streaming',
						name: 'enableStreaming',
						type: 'boolean',
						default: true,
						description: 'Whether to output structured block messages through the streaming output',
					},
					{
						displayName: 'Include Timestamps',
						name: 'includeTimestamps',
						type: 'boolean',
						default: true,
						description: 'Whether to include timestamps in block messages',
					},
					{
						displayName: 'Real-Time Webhook URL',
						name: 'webhookUrl',
						type: 'string',
						default: '',
						description: 'Webhook URL to send real-time streaming updates (optional). Example: https://your-n8n-instance/webhook/claude-streaming',
						placeholder: 'https://your-n8n-instance/webhook/claude-streaming',
					},
					{
						displayName: 'Channel Context',
						name: 'channelContext',
						type: 'string',
						default: '',
						description: 'Channel or conversation identifier for context (e.g., slack-C1234567890)',
						placeholder: 'slack-C1234567890',
					},
				],
			},
			{
				displayName: 'MCP Server Configuration',
				name: 'mcpConfiguration',
				type: 'collection',
				placeholder: 'Add MCP Server',
				default: {},
				description: 'Configure Model Context Protocol (MCP) servers for external tool integration',
				options: [
					{
						displayName: 'Enable MCP Servers',
						name: 'enableMcp',
						type: 'boolean',
						default: false,
						description: 'Whether to enable Model Context Protocol server integration',
					},
					{
						displayName: 'MCP Servers',
						name: 'mcpServers',
						type: 'fixedCollection',
						typeOptions: {
							multipleValues: true,
						},
						default: {},
						displayOptions: {
							show: {
								enableMcp: [true],
							},
						},
						options: [
							{
								name: 'servers',
								displayName: 'MCP Server',
								values: [
									{
										displayName: 'Server Name',
										name: 'name',
										type: 'string',
										default: '',
										required: true,
										description: 'Name identifier for the MCP server',
										placeholder: 'e.g., github, slack, database',
									},
									{
										displayName: 'Transport Type',
										name: 'transport',
										type: 'options',
										options: [
											{
												name: 'Stdio',
												value: 'stdio',
												description: 'Standard input/output communication',
											},
											{
												name: 'HTTP',
												value: 'http',
												description: 'HTTP request/response protocol',
											},
											{
												name: 'SSE',
												value: 'sse',
												description: 'Server-Sent Events streaming',
											},
										],
										default: 'stdio',
										description: 'Communication protocol for the MCP server',
									},
									{
										displayName: 'Command',
										name: 'command',
										type: 'string',
										default: '',
										description: 'Command to execute the MCP server (for stdio transport)',
										displayOptions: {
											show: {
												transport: ['stdio'],
											},
										},
										placeholder: 'e.g., npx, python, /path/to/server',
									},
									{
										displayName: 'Server URL',
										name: 'url',
										type: 'string',
										default: '',
										description: 'URL endpoint for the MCP server (for HTTP/SSE transport)',
										displayOptions: {
											show: {
												transport: ['http', 'sse'],
											},
										},
										placeholder: 'e.g., https://api.example.com/mcp',
									},
									{
										displayName: 'Arguments',
										name: 'args',
										type: 'string',
										typeOptions: {
											multipleValues: true,
										},
										default: [],
										description: 'Command arguments (for stdio transport)',
										displayOptions: {
											show: {
												transport: ['stdio'],
											},
										},
										placeholder: 'e.g., --api-key, ${API_KEY}',
									},
									{
										displayName: 'Environment Variables',
										name: 'env',
										type: 'fixedCollection',
										typeOptions: {
											multipleValues: true,
										},
										default: {},
										description: 'Environment variables for the MCP server',
										options: [
											{
												name: 'variables',
												displayName: 'Environment Variable',
												values: [
													{
														displayName: 'Name',
														name: 'name',
														type: 'string',
														default: '',
														required: true,
														placeholder: 'e.g., API_KEY, GITHUB_TOKEN',
													},
													{
														displayName: 'Value',
														name: 'value',
														type: 'string',
														default: '',
														required: true,
														placeholder: 'e.g., your-api-key-here',
													},
												],
											},
										],
									},
									{
										displayName: 'Headers',
										name: 'headers',
										type: 'fixedCollection',
										typeOptions: {
											multipleValues: true,
										},
										default: {},
										description: 'HTTP headers (for HTTP/SSE transport)',
										displayOptions: {
											show: {
												transport: ['http', 'sse'],
											},
										},
										options: [
											{
												name: 'headers',
												displayName: 'Header',
												values: [
													{
														displayName: 'Name',
														name: 'name',
														type: 'string',
														default: '',
														required: true,
														placeholder: 'e.g., Authorization, X-API-Key',
													},
													{
														displayName: 'Value',
														name: 'value',
														type: 'string',
														default: '',
														required: true,
														placeholder: 'e.g., Bearer token, api-key-value',
													},
												],
											},
										],
									},
									{
										displayName: 'Server Scope',
										name: 'scope',
										type: 'options',
										options: [
											{
												name: 'Local',
												value: 'local',
												description: 'Private to current execution (default)',
											},
											{
												name: 'Project',
												value: 'project',
												description: 'Shared via .mcp.json file',
											},
											{
												name: 'User',
												value: 'user',
												description: 'Global across projects',
											},
										],
										default: 'local',
										description: 'Installation scope for the MCP server',
									},
								],
							},
						],
					},
					{
						displayName: 'MCP Configuration File Path',
						name: 'mcpConfigPath',
						type: 'string',
						default: '',
						description: 'Path to .mcp.json configuration file (optional)',
						placeholder: 'e.g., /path/to/project/.mcp.json',
						displayOptions: {
							show: {
								enableMcp: [true],
							},
						},
					},
					{
						displayName: 'Allowed MCP Tools',
						name: 'allowedMcpTools',
						type: 'string',
						typeOptions: {
							multipleValues: true,
						},
						default: [],
						description: 'Specific MCP tools to allow (format: mcp__servername__toolname)',
						placeholder: 'e.g., mcp__github__create_pr, mcp__slack__send_message',
						displayOptions: {
							show: {
								enableMcp: [true],
							},
						},
					},
				],
			},
			{
				displayName: 'Claude Code Hooks',
				name: 'claudeHooks',
				type: 'collection',
				placeholder: 'Add Hook Configuration',
				default: {},
				description: 'Configure Claude Code hooks for custom workflows and automation',
				options: [
					{
						displayName: 'Enable Hooks',
						name: 'enableHooks',
						type: 'boolean',
						default: false,
						description: 'Whether to enable Claude Code hooks system',
					},
					{
						displayName: 'Pre-Tool Use Hooks',
						name: 'preToolUseHooks',
						type: 'fixedCollection',
						typeOptions: {
							multipleValues: true,
						},
						default: {},
						displayOptions: {
							show: {
								enableHooks: [true],
							},
						},
						description: 'Hooks that execute before tool usage for validation and control',
						options: [
							{
								name: 'hooks',
								displayName: 'Pre-Tool Use Hook',
								values: [
									{
										displayName: 'Tool Matcher',
										name: 'matcher',
										type: 'string',
										default: '',
										required: true,
										description: 'Tool name pattern to match (supports regex)',
										placeholder: 'e.g., Edit, Bash, Write|Edit, mcp__.*__write.*',
									},
									{
										displayName: 'Hook Command',
										name: 'command',
										type: 'string',
										default: '',
										required: true,
										description: 'Command to execute before tool use',
										placeholder: 'e.g., /path/to/validation-script.py',
									},
									{
										displayName: 'Permission Decision',
										name: 'permissionDecision',
										type: 'options',
										options: [
											{
												name: 'Allow',
												value: 'allow',
												description: 'Automatically allow tool execution',
											},
											{
												name: 'Deny',
												value: 'deny',
												description: 'Block tool execution',
											},
											{
												name: 'Ask',
												value: 'ask',
												description: 'Prompt user for confirmation',
											},
										],
										default: 'ask',
										description: 'Default permission decision for matched tools',
									},
								],
							},
						],
					},
					{
						displayName: 'Post-Tool Use Hooks',
						name: 'postToolUseHooks',
						type: 'fixedCollection',
						typeOptions: {
							multipleValues: true,
						},
						default: {},
						displayOptions: {
							show: {
								enableHooks: [true],
							},
						},
						description: 'Hooks that execute after tool usage for cleanup and formatting',
						options: [
							{
								name: 'hooks',
								displayName: 'Post-Tool Use Hook',
								values: [
									{
										displayName: 'Tool Matcher',
										name: 'matcher',
										type: 'string',
										default: '',
										required: true,
										description: 'Tool name pattern to match (supports regex)',
										placeholder: 'e.g., Edit|Write, MultiEdit, mcp__.*__.*',
									},
									{
										displayName: 'Hook Command',
										name: 'command',
										type: 'string',
										default: '',
										required: true,
										description: 'Command to execute after tool use',
										placeholder: 'e.g., prettier --write $file, /path/to/formatter.sh',
									},
								],
							},
						],
					},
					{
						displayName: 'Session Start Hooks',
						name: 'sessionStartHooks',
						type: 'fixedCollection',
						typeOptions: {
							multipleValues: true,
						},
						default: {},
						displayOptions: {
							show: {
								enableHooks: [true],
							},
						},
						description: 'Hooks that execute at session start for context injection',
						options: [
							{
								name: 'hooks',
								displayName: 'Session Start Hook',
								values: [
									{
										displayName: 'Hook Command',
										name: 'command',
										type: 'string',
										default: '',
										required: true,
										description: 'Command to execute at session start',
										placeholder: 'e.g., /path/to/context-injector.py',
									},
									{
										displayName: 'Additional Context',
										name: 'additionalContext',
										type: 'string',
										typeOptions: {
											rows: 3,
										},
										default: '',
										description: 'Static context to inject at session start',
										placeholder: 'e.g., Project guidelines, coding standards...',
									},
								],
							},
						],
					},
				],
			},
			{
				displayName: 'Advanced Configuration',
				name: 'advancedConfig',
				type: 'collection',
				placeholder: 'Add Advanced Option',
				default: {},
				description: 'Advanced Claude Code configuration options',
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
						displayName: 'Permission Mode',
						name: 'permissionMode',
						type: 'options',
						options: [
							{
								name: 'Default',
								value: 'default',
								description: 'Standard permission prompts for tool usage',
							},
							{
								name: 'Accept Edits',
								value: 'acceptEdits',
								description: 'Automatically accept file edits',
							},
							{
								name: 'Plan Mode',
								value: 'plan',
								description: 'Planning mode without execution',
							},
							{
								name: 'Bypass Permissions',
								value: 'bypassPermissions',
								description: 'Skip all permission prompts',
							},
						],
						default: 'default',
						description: 'Permission handling mode for Claude Code operations',
					},
					{
						displayName: 'Session Management',
						name: 'sessionManagement',
						type: 'options',
						options: [
							{
								name: 'New Session',
								value: 'new',
								description: 'Start a new conversation session',
							},
							{
								name: 'Continue Latest',
								value: 'continue',
								description: 'Continue the most recent conversation',
							},
							{
								name: 'Resume by ID',
								value: 'resume',
								description: 'Resume a specific session by ID',
							},
						],
						default: 'new',
						description: 'How to handle conversation session continuity',
					},
					{
						displayName: 'Session ID',
						name: 'sessionId',
						type: 'string',
						default: '',
						description: 'Specific session ID to resume (when using "Resume by ID")',
						placeholder: 'e.g., abc123-def456-ghi789',
						displayOptions: {
							show: {
								sessionManagement: ['resume'],
							},
						},
					},
					{
						displayName: 'Working Directory',
						name: 'workingDirectory',
						type: 'string',
						default: '',
						description: 'Override the working directory for Claude Code operations',
						placeholder: 'e.g., /path/to/project, ${HOME}/workspace',
					},
					{
						displayName: 'Environment Variables',
						name: 'environmentVariables',
						type: 'fixedCollection',
						typeOptions: {
							multipleValues: true,
						},
						default: {},
						description: 'Environment variables for Claude Code session',
						options: [
							{
								name: 'variables',
								displayName: 'Environment Variable',
								values: [
									{
										displayName: 'Name',
										name: 'name',
										type: 'string',
										default: '',
										required: true,
										placeholder: 'e.g., NODE_ENV, API_URL',
									},
									{
										displayName: 'Value',
										name: 'value',
										type: 'string',
										default: '',
										required: true,
										placeholder: 'e.g., production, https://api.example.com',
									},
								],
							},
						],
					},
					{
						displayName: 'Custom Executable',
						name: 'customExecutable',
						type: 'string',
						default: '',
						description: 'Path to custom Claude Code executable',
						placeholder: 'e.g., /usr/local/bin/claude, /path/to/custom-claude',
					},
					{
						displayName: 'Executable Arguments',
						name: 'executableArgs',
						type: 'string',
						typeOptions: {
							multipleValues: true,
						},
						default: [],
						description: 'Additional arguments for the Claude Code executable',
						placeholder: 'e.g., --verbose, --config=/path/to/config',
					},
					{
						displayName: 'Debug Mode',
						name: 'debug',
						type: 'boolean',
						default: false,
						description: 'Whether to enable debug logging',
					},
					{
						displayName: 'Enable Telemetry',
						name: 'enableTelemetry',
						type: 'boolean',
						default: false,
						description: 'Whether to enable OpenTelemetry monitoring',
					},
					{
						displayName: 'Telemetry Configuration',
						name: 'telemetryConfig',
						type: 'fixedCollection',
						typeOptions: {
							multipleValues: true,
						},
						default: {},
						displayOptions: {
							show: {
								enableTelemetry: [true],
							},
						},
						description: 'OpenTelemetry configuration options',
						options: [
							{
								name: 'configs',
								displayName: 'Telemetry Setting',
								values: [
									{
										displayName: 'Setting Name',
										name: 'name',
										type: 'string',
										default: '',
										required: true,
										placeholder: 'e.g., OTEL_EXPORTER_OTLP_ENDPOINT',
									},
									{
										displayName: 'Setting Value',
										name: 'value',
										type: 'string',
										default: '',
										required: true,
										placeholder: 'e.g., http://collector.company.com:4317',
									},
								],
							},
						],
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
					webhookUrl?: string;
					channelContext?: string;
				};
				
				// New configuration options
				const mcpConfiguration = this.getNodeParameter('mcpConfiguration', itemIndex) as {
					enableMcp?: boolean;
					mcpServers?: {
						servers?: Array<{
							name: string;
							transport: 'stdio' | 'http' | 'sse';
							command?: string;
							url?: string;
							args?: string[];
							env?: { variables?: Array<{ name: string; value: string }> };
							headers?: { headers?: Array<{ name: string; value: string }> };
							scope?: 'local' | 'project' | 'user';
						}>;
					};
					mcpConfigPath?: string;
					allowedMcpTools?: string[];
				};
				
				const claudeHooks = this.getNodeParameter('claudeHooks', itemIndex) as {
					enableHooks?: boolean;
					preToolUseHooks?: {
						hooks?: Array<{
							matcher: string;
							command: string;
							permissionDecision: 'allow' | 'deny' | 'ask';
						}>;
					};
					postToolUseHooks?: {
						hooks?: Array<{
							matcher: string;
							command: string;
						}>;
					};
					sessionStartHooks?: {
						hooks?: Array<{
							command: string;
							additionalContext?: string;
						}>;
					};
				};
				
				const advancedConfig = this.getNodeParameter('advancedConfig', itemIndex) as {
					systemPrompt?: string;
					permissionMode?: 'default' | 'acceptEdits' | 'plan' | 'bypassPermissions';
					sessionManagement?: 'new' | 'continue' | 'resume';
					sessionId?: string;
					workingDirectory?: string;
					environmentVariables?: { variables?: Array<{ name: string; value: string }> };
					customExecutable?: string;
					executableArgs?: string[];
					debug?: boolean;
					enableTelemetry?: boolean;
					telemetryConfig?: { configs?: Array<{ name: string; value: string }> };
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

				// Debug logging
				const debugEnabled = advancedConfig.debug || false;
				if (debugEnabled) {
					console.log(`[ClaudeCodeStreaming] Starting execution for item ${itemIndex}`);
					console.log(`[ClaudeCodeStreaming] Prompt: ${prompt.substring(0, 100)}...`);
					console.log(`[ClaudeCodeStreaming] Model: ${model}`);
					console.log(`[ClaudeCodeStreaming] Streaming enabled: ${streamingOptions.enableStreaming}`);
					console.log(`[ClaudeCodeStreaming] Webhook URL: ${streamingOptions.webhookUrl || 'Not configured'}`);
					console.log(`[ClaudeCodeStreaming] MCP enabled: ${mcpConfiguration.enableMcp}`);
					console.log(`[ClaudeCodeStreaming] Hooks enabled: ${claudeHooks.enableHooks}`);
					console.log(`[ClaudeCodeStreaming] Session management: ${advancedConfig.sessionManagement}`);
				}

				// Get original message context for real-time streaming
				const originalContext = items[itemIndex].json || {};

				// Helper function to convert SDK messages to block messages
				const createBlockMessage = (type: BlockMessage['type'], content: string, metadata?: Record<string, any>): BlockMessage => {
					return {
						type,
						content,
						timestamp: streamingOptions.includeTimestamps !== false ? new Date().toISOString() : '',
						metadata: metadata || {},
					};
				};

				// Build environment variables for Claude Code
				const envVars: Record<string, string> = {};
				
				// Add telemetry configuration if enabled
				if (advancedConfig.enableTelemetry) {
					envVars.CLAUDE_CODE_ENABLE_TELEMETRY = '1';
					if (advancedConfig.telemetryConfig?.configs) {
						for (const config of advancedConfig.telemetryConfig.configs) {
							if (config.name && config.value) {
								envVars[config.name] = config.value;
							}
						}
					}
				}
				
				// Add custom environment variables
				if (advancedConfig.environmentVariables?.variables) {
					for (const envVar of advancedConfig.environmentVariables.variables) {
						if (envVar.name && envVar.value) {
							envVars[envVar.name] = envVar.value;
						}
					}
				}
				
				// Build MCP servers configuration
				const mcpServers: Record<string, any> = {};
				if (mcpConfiguration.enableMcp && mcpConfiguration.mcpServers?.servers) {
					for (const server of mcpConfiguration.mcpServers.servers) {
						if (!server.name) continue;
						
						const serverConfig: Record<string, any> = {
							type: server.transport,
						};
						
						if (server.transport === 'stdio') {
							if (server.command) serverConfig.command = server.command;
							if (server.args) serverConfig.args = server.args;
						} else {
							if (server.url) serverConfig.url = server.url;
							if (server.headers?.headers) {
								serverConfig.headers = {};
								for (const header of server.headers.headers) {
									if (header.name && header.value) {
										serverConfig.headers[header.name] = header.value;
									}
								}
							}
						}
						
						if (server.env?.variables) {
							serverConfig.env = {};
							for (const envVar of server.env.variables) {
								if (envVar.name && envVar.value) {
									serverConfig.env[envVar.name] = envVar.value;
								}
							}
						}
						
						mcpServers[server.name] = serverConfig;
					}
				}
				
				// Build hooks configuration
				const hooksConfig: Record<string, any> = {};
				if (claudeHooks.enableHooks) {
					if (claudeHooks.preToolUseHooks?.hooks && claudeHooks.preToolUseHooks.hooks.length > 0) {
						hooksConfig.PreToolUse = claudeHooks.preToolUseHooks.hooks.map(hook => ({
							matcher: hook.matcher,
							hooks: [{
								type: 'command',
								command: hook.command,
							}],
							permissionDecision: hook.permissionDecision,
						}));
					}
					
					if (claudeHooks.postToolUseHooks?.hooks && claudeHooks.postToolUseHooks.hooks.length > 0) {
						hooksConfig.PostToolUse = claudeHooks.postToolUseHooks.hooks.map(hook => ({
							matcher: hook.matcher,
							hooks: [{
								type: 'command',
								command: hook.command,
							}],
						}));
					}
					
					if (claudeHooks.sessionStartHooks?.hooks && claudeHooks.sessionStartHooks.hooks.length > 0) {
						hooksConfig.SessionStart = claudeHooks.sessionStartHooks.hooks.map(hook => ({
							hooks: [{
								type: 'command',
								command: hook.command,
							}],
							...(hook.additionalContext && { additionalContext: hook.additionalContext }),
						}));
					}
				}
				
				// Determine permission mode
				let permissionMode: 'default' | 'acceptEdits' | 'plan' | 'bypassPermissions' = 'default';
				if (advancedConfig.permissionMode) {
					permissionMode = advancedConfig.permissionMode;
				}
				
				// Determine session management
				const sessionOptions: Record<string, any> = {};
				if (advancedConfig.sessionManagement === 'continue') {
					sessionOptions.continue = true;
				} else if (advancedConfig.sessionManagement === 'resume' && advancedConfig.sessionId) {
					sessionOptions.resume = advancedConfig.sessionId;
				} else {
					sessionOptions.continue = true; // Default to continuing conversation
				}
				
				// Build comprehensive allowed tools list
				const allAllowedTools = [...allowedTools];
				if (mcpConfiguration.enableMcp && mcpConfiguration.allowedMcpTools) {
					allAllowedTools.push(...mcpConfiguration.allowedMcpTools);
				}

				// Build query options - using SDK's built-in conversation persistence
				const queryOptions = {
					prompt,
					abortController,
					options: {
						maxTurns,
						permissionMode,
						model,
						...sessionOptions,
						...(advancedConfig.systemPrompt && { systemPrompt: advancedConfig.systemPrompt }),
						...(advancedConfig.workingDirectory && { cwd: advancedConfig.workingDirectory }),
						...(projectPath && projectPath.trim() && !advancedConfig.workingDirectory && { cwd: projectPath.trim() }),
						...(allAllowedTools.length > 0 && { allowedTools: allAllowedTools }),
						...(Object.keys(mcpServers).length > 0 && { mcpServers }),
						...(mcpConfiguration.mcpConfigPath && { mcpConfig: mcpConfiguration.mcpConfigPath }),
						...(Object.keys(hooksConfig).length > 0 && { hooks: hooksConfig }),
						...(advancedConfig.customExecutable && { pathToClaudeCodeExecutable: advancedConfig.customExecutable }),
						...(advancedConfig.executableArgs && advancedConfig.executableArgs.length > 0 && { executableArgs: advancedConfig.executableArgs }),
						...(Object.keys(envVars).length > 0 && { env: envVars }),
					},
				};

				// Execute query with real-time streaming
				const messages: SDKMessage[] = [];
				const startTime = Date.now();

				try {
					// Process each message as it arrives for real-time streaming
					for await (const message of query(queryOptions)) {
						messages.push(message);

						// Create and send block messages immediately if streaming enabled
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

							// Send block message to streaming output immediately
							if (blockMessage) {
								// Add to streaming output for final batch delivery
								streamingData.push({
									json: blockMessage,
									pairedItem: itemIndex,
								});

								// Send real-time update to webhook if URL is configured
								if (streamingOptions.webhookUrl && streamingOptions.webhookUrl.trim()) {
									try {
										// Send immediately via HTTP request for real-time updates
										await this.helpers.httpRequest({
											method: 'POST',
											url: streamingOptions.webhookUrl.trim(),
											headers: {
												'Content-Type': 'application/json',
												'User-Agent': 'n8n-claude-code-streaming',
											},
											body: {
												blockMessage,
												context: originalContext,
												timestamp: new Date().toISOString(),
												source: 'claude-code-streaming-node',
											},
											timeout: 5000, // 5 second timeout for webhook calls
										});

										if (debugEnabled) {
											console.log(`[ClaudeCodeStreaming] Sent real-time update: ${blockMessage.type}`);
										}
									} catch (webhookError) {
										// Log webhook errors but don't fail the main execution
										if (debugEnabled) {
											console.warn(`[ClaudeCodeStreaming] Webhook error:`, webhookError instanceof Error ? webhookError.message : 'Unknown error');
										}
									}
								}
							}
						}

						// Debug logging
						if (debugEnabled) {
							console.log(`[ClaudeCodeStreaming] Received message type: ${message.type}`);
						}
					}

					clearTimeout(timeoutId);

					const duration = Date.now() - startTime;
					if (debugEnabled) {
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

						// Send error to webhook for real-time notification
						if (streamingOptions.webhookUrl && streamingOptions.webhookUrl.trim()) {
							try {
								await this.helpers.httpRequest({
									method: 'POST',
									url: streamingOptions.webhookUrl.trim(),
									headers: {
										'Content-Type': 'application/json',
										'User-Agent': 'n8n-claude-code-streaming',
									},
									body: {
										blockMessage: errorBlock,
										context: originalContext,
										timestamp: new Date().toISOString(),
										source: 'claude-code-streaming-node-error',
									},
									timeout: 5000,
								});
							} catch (webhookError) {
								// Ignore webhook errors during error handling
							}
						}
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