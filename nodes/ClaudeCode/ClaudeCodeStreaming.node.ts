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
						description: 'Webhook URL to send real-time streaming updates (optional). Example: https://your-n8n-instance/webhook/claude-streaming.',
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
				displayName: 'Claude Code Hooks',
				name: 'hooksConfiguration',
				type: 'collection',
				placeholder: 'Add Hook Configuration',
				default: {},
				description: 'Configure Claude Code hooks to intercept and customize tool execution',
				options: [
					{
						displayName: 'Enable Hooks',
						name: 'enableHooks',
						type: 'boolean',
						default: false,
						description: 'Whether to enable Claude Code hooks for this execution',
					},
					{
						displayName: 'Hook Events',
						name: 'hookEvents',
						type: 'fixedCollection',
						placeholder: 'Add Hook Event',
						default: {},
						typeOptions: {
							multipleValues: true,
						},
						displayOptions: {
							show: {
								enableHooks: [true],
							},
						},
						options: [
							{
								name: 'preToolUse',
								displayName: 'Pre-Tool Use Hooks',
								values: [
									{
										displayName: 'Tool Pattern',
										name: 'matcher',
										type: 'string',
										default: '*',
										description: 'Tool name pattern to match (e.g., "Write", "Bash", "*" for all)',
										placeholder: 'Write|Edit|Bash',
									},
									{
										displayName: 'Hook Command',
										name: 'command',
										type: 'string',
										default: '',
										description: 'Command to execute when this hook is triggered',
										placeholder: 'python ./hooks/validate-tool.py',
									},
									{
										displayName: 'Description',
										name: 'description',
										type: 'string',
										default: '',
										description: 'Optional description of what this hook does',
									},
								],
							},
							{
								name: 'postToolUse',
								displayName: 'Post-Tool Use Hooks',
								values: [
									{
										displayName: 'Tool Pattern',
										name: 'matcher',
										type: 'string',
										default: '*',
										description: 'Tool name pattern to match (e.g., "Write", "Bash", "*" for all)',
										placeholder: 'Write|Edit',
									},
									{
										displayName: 'Hook Command',
										name: 'command',
										type: 'string',
										default: '',
										description: 'Command to execute when this hook is triggered',
										placeholder: 'python ./hooks/post-process.py',
									},
									{
										displayName: 'Description',
										name: 'description',
										type: 'string',
										default: '',
										description: 'Optional description of what this hook does',
									},
								],
							},
							{
								name: 'userPromptSubmit',
								displayName: 'User Prompt Submit Hooks',
								values: [
									{
										displayName: 'Hook Command',
										name: 'command',
										type: 'string',
										default: '',
										description: 'Command to execute when user submits a prompt',
										placeholder: 'python ./hooks/validate-prompt.py',
									},
									{
										displayName: 'Description',
										name: 'description',
										type: 'string',
										default: '',
										description: 'Optional description of what this hook does',
									},
								],
							},
							{
								name: 'stop',
								displayName: 'Stop Hooks',
								values: [
									{
										displayName: 'Hook Command',
										name: 'command',
										type: 'string',
										default: '',
										description: 'Command to execute when Claude tries to stop',
										placeholder: 'python ./hooks/before-stop.py',
									},
									{
										displayName: 'Description',
										name: 'description',
										type: 'string',
										default: '',
										description: 'Optional description of what this hook does',
									},
								],
							},
						],
					},
					{
						displayName: 'Hooks Output Mode',
						name: 'hooksOutputMode',
						type: 'options',
						options: [
							{
								name: 'Silent',
								value: 'silent',
								description: 'Hook execution happens in the background without streaming output',
							},
							{
								name: 'Streaming',
								value: 'streaming',
								description: 'Hook events and results are sent to streaming output',
							},
							{
								name: 'Webhook',
								value: 'webhook',
								description: 'Hook events are sent to configured webhook URL',
							},
						],
						default: 'streaming',
						displayOptions: {
							show: {
								enableHooks: [true],
							},
						},
						description: 'How to handle hook execution output',
					},
					{
						displayName: 'Hook Timeout (Seconds)',
						name: 'hookTimeout',
						type: 'number',
						default: 30,
						displayOptions: {
							show: {
								enableHooks: [true],
							},
						},
						description: 'Maximum time to wait for hook execution before timing out',
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
					webhookUrl?: string;
				};
				const additionalOptions = this.getNodeParameter('additionalOptions', itemIndex) as {
					systemPrompt?: string;
					requirePermissions?: boolean;
					debug?: boolean;
				};
				const hooksConfiguration = this.getNodeParameter('hooksConfiguration', itemIndex) as {
					enableHooks?: boolean;
					hookEvents?: {
						preToolUse?: Array<{ matcher: string; command: string; description?: string }>;
						postToolUse?: Array<{ matcher: string; command: string; description?: string }>;
						userPromptSubmit?: Array<{ command: string; description?: string }>;
						stop?: Array<{ command: string; description?: string }>;
					};
					hooksOutputMode?: 'silent' | 'streaming' | 'webhook';
					hookTimeout?: number;
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
				if (additionalOptions.debug) {
					console.log(`[ClaudeCodeStreaming] Starting execution for item ${itemIndex}`);
					console.log(`[ClaudeCodeStreaming] Prompt: ${prompt.substring(0, 100)}...`);
					console.log(`[ClaudeCodeStreaming] Model: ${model}`);
					console.log(`[ClaudeCodeStreaming] Streaming enabled: ${streamingOptions.enableStreaming}`);
					console.log(`[ClaudeCodeStreaming] Webhook URL: ${streamingOptions.webhookUrl || 'Not configured'}`);
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

				// Build query options - using SDK's built-in conversation persistence
				const queryOptions = {
					prompt,
					abortController,
					options: {
						maxTurns,
						permissionMode: (additionalOptions.requirePermissions ? 'default' : 'bypassPermissions') as 'default' | 'bypassPermissions',
						model,
						continue: true, // Use SDK's conversation persistence
						...(additionalOptions.systemPrompt && { systemPrompt: additionalOptions.systemPrompt }),
						...(projectPath && projectPath.trim() && { cwd: projectPath.trim() }),
						...(allowedTools.length > 0 && { allowedTools }),
					},
				};

				// Setup Claude Code hooks if enabled
				let hooksSetup = false;
				if (hooksConfiguration.enableHooks && projectPath && projectPath.trim()) {
					const fs = await import('fs');
					const path = await import('path');
					
					try {
						const projectDir = projectPath.trim();
						const claudeDir = path.join(projectDir, '.claude');
						const hooksFile = path.join(claudeDir, 'hooks.json');

						// Create .claude directory if it doesn't exist
						if (!fs.existsSync(claudeDir)) {
							fs.mkdirSync(claudeDir, { recursive: true });
						}

						// Build hooks configuration
						const hooksConfig: any = { hooks: {} };

						// Add PreToolUse hooks
						if (hooksConfiguration.hookEvents?.preToolUse?.length) {
							hooksConfig.hooks.PreToolUse = hooksConfiguration.hookEvents.preToolUse.map(hook => ({
								matcher: hook.matcher || '*',
								hooks: [{
									type: 'command',
									command: hook.command,
									...(hook.description && { description: hook.description })
								}]
							}));
						}

						// Add PostToolUse hooks
						if (hooksConfiguration.hookEvents?.postToolUse?.length) {
							hooksConfig.hooks.PostToolUse = hooksConfiguration.hookEvents.postToolUse.map(hook => ({
								matcher: hook.matcher || '*',
								hooks: [{
									type: 'command',
									command: hook.command,
									...(hook.description && { description: hook.description })
								}]
							}));
						}

						// Add UserPromptSubmit hooks (no matcher needed)
						if (hooksConfiguration.hookEvents?.userPromptSubmit?.length) {
							hooksConfig.hooks.UserPromptSubmit = hooksConfiguration.hookEvents.userPromptSubmit.map(hook => ({
								hooks: [{
									type: 'command',
									command: hook.command,
									...(hook.description && { description: hook.description })
								}]
							}));
						}

						// Add Stop hooks (no matcher needed)
						if (hooksConfiguration.hookEvents?.stop?.length) {
							hooksConfig.hooks.Stop = hooksConfiguration.hookEvents.stop.map(hook => ({
								hooks: [{
									type: 'command',
									command: hook.command,
									...(hook.description && { description: hook.description })
								}]
							}));
						}

						// Write hooks configuration file
						fs.writeFileSync(hooksFile, JSON.stringify(hooksConfig, null, 2));
						hooksSetup = true;

						if (additionalOptions.debug) {
							console.log(`[ClaudeCodeStreaming] Hooks configuration written to: ${hooksFile}`);
							console.log(`[ClaudeCodeStreaming] Hooks config:`, JSON.stringify(hooksConfig, null, 2));
						}

						// Send hooks setup notification if streaming enabled
						if (streamingOptions.enableStreaming && hooksConfiguration.hooksOutputMode !== 'silent') {
							const setupBlock = createBlockMessage('status', `Claude Code hooks configured: ${Object.keys(hooksConfig.hooks).join(', ')}`, {
								hooksFile,
								enabledHooks: Object.keys(hooksConfig.hooks),
							});
							streamingData.push({
								json: setupBlock,
								pairedItem: itemIndex,
							});

							// Send to webhook if configured
							if (streamingOptions.webhookUrl && streamingOptions.webhookUrl.trim() && hooksConfiguration.hooksOutputMode === 'webhook') {
								try {
									await this.helpers.httpRequest({
										method: 'POST',
										url: streamingOptions.webhookUrl.trim(),
										headers: {
											'Content-Type': 'application/json',
											'User-Agent': 'n8n-claude-code-streaming',
										},
										body: {
											blockMessage: setupBlock,
											context: originalContext,
											timestamp: new Date().toISOString(),
											source: 'claude-code-hooks-setup',
										},
										timeout: 5000,
									});
								} catch (webhookError) {
									if (additionalOptions.debug) {
										console.log(`[ClaudeCodeStreaming] Webhook error:`, webhookError);
									}
								}
							}
						}

					} catch (hooksError) {
						if (additionalOptions.debug) {
							console.log(`[ClaudeCodeStreaming] Failed to setup hooks:`, hooksError);
						}
						
						// Send error to streaming if enabled
						if (streamingOptions.enableStreaming) {
							const errorBlock = createBlockMessage('error', `Failed to setup hooks: ${hooksError instanceof Error ? hooksError.message : 'Unknown error'}`);
							streamingData.push({
								json: errorBlock,
								pairedItem: itemIndex,
							});
						}
					}
				}

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

									// Detect hook events if hooks are enabled
									if (hooksSetup && hooksConfiguration.hooksOutputMode !== 'silent') {
										const hookBlock = createBlockMessage('status', `Pre-tool hook triggered for: ${content.name}`, {
											hookType: 'PreToolUse',
											toolName: content.name,
											toolInput: content.input,
											hooksEnabled: true,
										});
										streamingData.push({
											json: hookBlock,
											pairedItem: itemIndex,
										});
									}
								}
							} else if (message.type === 'assistant' && (message as any).result) {
								// Tool result - this might be tool completion
								if (hooksSetup && hooksConfiguration.hooksOutputMode !== 'silent') {
									const hookBlock = createBlockMessage('status', `Post-tool hook may be triggered`, {
										hookType: 'PostToolUse',
										hooksEnabled: true,
									});
									streamingData.push({
										json: hookBlock,
										pairedItem: itemIndex,
									});
									// Send hook event to webhook if configured and mode is webhook
									if (streamingOptions.webhookUrl && streamingOptions.webhookUrl.trim() && hooksConfiguration.hooksOutputMode === 'webhook') {
										try {
											await this.helpers.httpRequest({
												method: 'POST',
												url: streamingOptions.webhookUrl.trim(),
												headers: {
													'Content-Type': 'application/json',
													'User-Agent': 'n8n-claude-code-streaming',
												},
												body: {
													blockMessage: hookBlock,
													context: originalContext,
													timestamp: new Date().toISOString(),
													source: 'claude-code-hooks-event',
												},
												timeout: 5000,
											});
										} catch (webhookError) {
											if (additionalOptions.debug) {
												console.warn(
													`[ClaudeCodeStreaming] Webhook error:`,
													webhookError instanceof Error ? webhookError.message : 'Unknown error',
												);
											}
										}
									}
								}
								
								blockMessage = createBlockMessage('tool_result', 'Tool execution completed', {
									messageId: (message as any).id,
									result: (message as any).result,
								});
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

										if (additionalOptions.debug) {
											console.log(`[ClaudeCodeStreaming] Sent real-time update: ${blockMessage.type}`);
										}
									} catch (webhookError) {
										// Log webhook errors but don't fail the main execution
										if (additionalOptions.debug) {
											console.warn(`[ClaudeCodeStreaming] Webhook error:`, webhookError instanceof Error ? webhookError.message : 'Unknown error');
										}
									}
								}
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