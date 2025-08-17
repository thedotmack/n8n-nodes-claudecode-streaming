import type {
	IExecuteFunctions,
	INodeExecutionData,
	INodeType,
	INodeTypeDescription,
} from 'n8n-workflow';
import { NodeConnectionType, NodeOperationError } from 'n8n-workflow';
import { query, type SDKMessage } from '@anthropic-ai/claude-code';
import * as crypto from 'crypto';

// Interface for thread persistence
interface ThreadData {
	threadId: string;
	createdAt: string;
	lastMessageAt: string;
	messageHistory: SDKMessage[];
	metadata?: Record<string, any>;
}

export class ClaudeCodeStreaming implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'Claude Code Streaming',
		name: 'claudeCodeStreaming',
		icon: 'file:claudecode.svg',
		group: ['transform'],
		version: 1,
		subtitle: '={{$parameter["operation"] + ": " + ($parameter["threadId"] || $parameter["prompt"])}}',
		description:
			'AI coding assistant with persistent conversation threads and dual-output streaming. Features thread management, real-time updates, and flexible routing.',
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
				displayName: 'Operation',
				name: 'operation',
				type: 'options',
				noDataExpression: true,
				options: [
					{
						name: 'New Thread',
						value: 'newThread',
						description: 'Start a new persistent conversation with automatic or custom thread ID',
						action: 'Start a new conversation thread with a unique id',
					},
					{
						name: 'Continue Thread',
						value: 'continueThread',
						description: 'Continue a specific conversation using its thread ID (preserves full context)',
						action: 'Continue a specific conversation thread by id',
					},
					{
						name: 'Continue Last',
						value: 'continueLast',
						description: 'Continue the most recently active conversation thread',
						action: 'Continue the most recent conversation',
					},
					{
						name: 'List Threads',
						value: 'listThreads',
						description: 'Get all conversation threads with metadata and timestamps',
						action: 'List all available conversation threads',
					},
				],
				default: 'newThread',
			},
			{
				displayName: 'Thread ID',
				name: 'threadId',
				type: 'string',
				displayOptions: {
					show: {
						operation: ['continueThread'],
					},
				},
				default: '',
				description: 'The unique thread ID from a previous conversation (found in output or "List Threads")',
				required: true,
				placeholder: 'e.g., "thread_abc123xyz" or {{$json.threadId}}',
				hint: 'Use the threadId from previous Claude Code outputs or List Threads operation',
			},
			{
				displayName: 'Custom Thread ID',
				name: 'customThreadId',
				type: 'string',
				displayOptions: {
					show: {
						operation: ['newThread'],
					},
				},
				default: '',
				description: 'Optional custom thread ID for easy identification. Auto-generated if empty.',
				placeholder: 'e.g., "user_123_support" or {{$json.userId}}_session',
				hint: 'Use meaningful names like user IDs or session identifiers for easy thread management',
			},
			{
				displayName: 'Prompt',
				name: 'prompt',
				type: 'string',
				typeOptions: {
					rows: 4,
				},
				displayOptions: {
					hide: {
						operation: ['listThreads'],
					},
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
				placeholder: '/home/user/projects/my-app',
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
					{
						name: 'Thread Info',
						value: 'threadInfo',
						description: 'Returns thread metadata with messages and persistence info',
					},
				],
				default: 'structured',
				description: 'Choose how to format the output data',
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
						displayName: 'Enable Streaming Output',
						name: 'enableStreamingOutput',
						type: 'boolean',
						default: false,
						description: 'Whether to output streaming messages through the second output branch for routing',
					},
					{
						displayName: 'Enable Direct Webhook',
						name: 'enableStreaming',
						type: 'boolean',
						default: false,
						description: 'Whether to send real-time updates directly to Slack webhook (legacy mode)',
					},
					{
						displayName: 'Webhook URL',
						name: 'webhookUrl',
						type: 'string',
						default: '',
						description: 'Slack webhook URL to send streaming updates to',
						placeholder: 'https://hooks.slack.com/services/...',
						displayOptions: {
							show: {
								enableStreaming: [true],
							},
						},
					},
					{
						displayName: 'Thread Timestamp',
						name: 'threadTimestamp',
						type: 'string',
						default: '',
						description: 'Slack thread timestamp to reply to (optional)',
						displayOptions: {
							show: {
								enableStreaming: [true],
							},
						},
					},
					{
						displayName: 'Stream Format',
						name: 'streamFormat',
						type: 'options',
						options: [
							{
								name: 'Status Updates',
								value: 'status',
								description: 'Send status updates about tool usage and progress',
							},
							{
								name: 'Full Messages',
								value: 'full',
								description: 'Send complete messages as they are received',
							},
							{
								name: 'Message Chunks',
								value: 'chunks',
								description: 'Send raw message chunks for real-time streaming',
							},
						],
						default: 'status',
						description: 'Choose what type of updates to stream to Slack',
						displayOptions: {
							show: {
								enableStreaming: [true],
							},
						},
					},
					{
						displayName: 'Batch Interval (ms)',
						name: 'batchInterval',
						type: 'number',
						default: 2000,
						description: 'Minimum time between webhook calls to avoid rate limits',
						displayOptions: {
							show: {
								enableStreaming: [true],
							},
						},
					},
				],
			},
			{
				displayName: 'Thread Management',
				name: 'threadManagement',
				type: 'collection',
				placeholder: 'Add Thread Option',
				default: {},
				description: 'Configure conversation persistence and thread management',
				options: [
					{
						displayName: 'Thread Metadata',
						name: 'threadMetadata',
						type: 'json',
						default: '{}',
						description: 'Store custom data with the thread (e.g., user info, context)',
						placeholder: '{"userId": "123", "department": "support", "priority": "high"}',
					},
					{
						displayName: 'Max Thread History',
						name: 'maxThreadHistory',
						type: 'number',
						default: 50,
						description: 'Maximum number of messages to keep in thread history (older messages are removed)',
					},
					{
						displayName: 'Include Timestamps',
						name: 'includeTimestamps',
						type: 'boolean',
						default: true,
						description: 'Whether to include timestamps in thread data outputs',
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
							'You are helping with a Python project. Focus on clean, readable code with proper error handling.',
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
		const staticData = this.getWorkflowStaticData('global');

		for (let itemIndex = 0; itemIndex < items.length; itemIndex++) {
			let timeout = 300; // Default timeout
			try {
				const operation = this.getNodeParameter('operation', itemIndex) as string;
				
				// Handle list threads operation
				if (operation === 'listThreads') {
					const threads = (staticData['claude_threads_list'] as any[]) || [];
					returnData.push({
						json: {
							threads,
							threadCount: threads.length,
						},
						pairedItem: itemIndex,
					});
					continue;
				}
				const prompt = this.getNodeParameter('prompt', itemIndex) as string;
				const model = this.getNodeParameter('model', itemIndex) as string;
				const maxTurns = this.getNodeParameter('maxTurns', itemIndex) as number;
				timeout = this.getNodeParameter('timeout', itemIndex) as number;
				const projectPath = this.getNodeParameter('projectPath', itemIndex) as string;
				const outputFormat = this.getNodeParameter('outputFormat', itemIndex) as string;
				const allowedTools = this.getNodeParameter('allowedTools', itemIndex, []) as string[];
				const streamingOptions = this.getNodeParameter('streamingOptions', itemIndex) as {
					enableStreamingOutput?: boolean;
					enableStreaming?: boolean;
					webhookUrl?: string;
					threadTimestamp?: string;
					streamFormat?: string;
					batchInterval?: number;
				};
				const threadManagement = this.getNodeParameter('threadManagement', itemIndex) as {
					threadMetadata?: string;
					maxThreadHistory?: number;
					includeTimestamps?: boolean;
				};
				const additionalOptions = this.getNodeParameter('additionalOptions', itemIndex) as {
					systemPrompt?: string;
					requirePermissions?: boolean;
					debug?: boolean;
				};

				// Parse thread metadata if provided
				let threadMetadata: Record<string, any> = {};
				if (threadManagement.threadMetadata) {
					try {
						threadMetadata = JSON.parse(threadManagement.threadMetadata);
					} catch (e) {
						console.warn('Failed to parse thread metadata:', e);
					}
				}

				// Determine thread ID and load existing thread data
				let threadId: string;
				let threadData: ThreadData | null = null;
				let isNewThread = false;

				if (operation === 'newThread') {
					const customThreadId = this.getNodeParameter('customThreadId', itemIndex, '') as string;
					// Generate thread ID inline
					if (customThreadId) {
						threadId = customThreadId;
						// Check if custom thread ID already exists
						if (staticData[`claude_thread_${customThreadId}`]) {
							throw new NodeOperationError(
								this.getNode(),
								`Thread with ID "${customThreadId}" already exists. Use "Continue Thread" operation instead.`,
								{ itemIndex }
							);
						}
					} else {
						// Generate unique thread ID
						const timestamp = Date.now();
						const random = crypto.randomBytes(8).toString('hex');
						threadId = `thread_${timestamp}_${random}`;
					}
					isNewThread = true;
				} else if (operation === 'continueThread') {
					threadId = this.getNodeParameter('threadId', itemIndex) as string;
					threadData = (staticData[`claude_thread_${threadId}`] as ThreadData) || null;
					
					if (!threadData) {
						throw new NodeOperationError(
							this.getNode(),
							`Thread with ID "${threadId}" not found. Available threads can be listed using "List Threads" operation.`,
							{ itemIndex }
						);
					}
				} else if (operation === 'continueLast') {
					const threadsList = (staticData['claude_threads_list'] as any[]) || [];
					if (threadsList.length === 0) {
						throw new NodeOperationError(
							this.getNode(),
							'No previous conversation found. Start a new thread first.',
							{ itemIndex }
						);
					}
					const mostRecent = threadsList[0];
					threadData = (staticData[`claude_thread_${mostRecent.threadId}`] as ThreadData) || null;
					if (!threadData) {
						throw new NodeOperationError(
							this.getNode(),
							'Thread data corrupted. Please use a specific thread ID.',
							{ itemIndex }
						);
					}
					threadId = threadData.threadId;
				} else {
					// Default to new thread for backward compatibility
					const timestamp = Date.now();
					const random = crypto.randomBytes(8).toString('hex');
					threadId = `thread_${timestamp}_${random}`;
					isNewThread = true;
				}

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

				// Validate streaming options
				if (streamingOptions.enableStreaming && !streamingOptions.webhookUrl) {
					throw new NodeOperationError(this.getNode(), 'Webhook URL is required when streaming is enabled', {
						itemIndex,
					});
				}

				// Log start
				if (additionalOptions.debug) {
					console.log(`[ClaudeCodeStreaming] Starting execution for item ${itemIndex}`);
					console.log(`[ClaudeCodeStreaming] Operation: ${operation}`);
					console.log(`[ClaudeCodeStreaming] Thread ID: ${threadId}`);
					console.log(`[ClaudeCodeStreaming] Is new thread: ${isNewThread}`);
					console.log(`[ClaudeCodeStreaming] Prompt: ${prompt.substring(0, 100)}...`);
					console.log(`[ClaudeCodeStreaming] Model: ${model}`);
					console.log(`[ClaudeCodeStreaming] Max turns: ${maxTurns}`);
					console.log(`[ClaudeCodeStreaming] Timeout: ${timeout}s`);
					console.log(`[ClaudeCodeStreaming] Allowed built-in tools: ${allowedTools.join(', ')}`);
					console.log(`[ClaudeCodeStreaming] Streaming enabled: ${streamingOptions.enableStreaming}`);
				}

				// Build query options
				interface QueryOptions {
					prompt: string;
					abortController: AbortController;
					options: {
						maxTurns: number;
						permissionMode: 'default' | 'bypassPermissions';
						model: string;
						systemPrompt?: string;
						mcpServers?: Record<string, any>;
						allowedTools?: string[];
						continue?: boolean;
						cwd?: string;
					};
				}

				const queryOptions: QueryOptions = {
					prompt,
					abortController,
					options: {
						maxTurns,
						permissionMode: additionalOptions.requirePermissions ? 'default' : 'bypassPermissions',
						model,
					},
				};

				// Add optional parameters
				if (additionalOptions.systemPrompt) {
					queryOptions.options.systemPrompt = additionalOptions.systemPrompt;
				}

				// Add project path (cwd) if specified
				if (projectPath && projectPath.trim() !== '') {
					queryOptions.options.cwd = projectPath.trim();
					if (additionalOptions.debug) {
						console.log(`[ClaudeCodeStreaming] Working directory set to: ${queryOptions.options.cwd}`);
					}
				}

				// Set allowed tools if any are specified
				if (allowedTools.length > 0) {
					queryOptions.options.allowedTools = allowedTools;
					if (additionalOptions.debug) {
						console.log(`[ClaudeCodeStreaming] Allowed tools: ${allowedTools.join(', ')}`);
					}
				}

				// Add continue flag for existing threads
				if (!isNewThread && threadData) {
					queryOptions.options.continue = true;
				}

				// Initialize streaming variables
				let lastStreamTime = 0;
				const batchInterval = streamingOptions.batchInterval || 2000;
				let messageBuffer: string[] = [];
				const streamingOutputMessages: any[] = [];

				// Helper function to collect and/or send streaming update
				const handleStreamingUpdate = async (message: string, messageType: string = 'info', force = false) => {
					const timestamp = new Date().toISOString();
					
					// Collect for output branch if enabled
					if (streamingOptions.enableStreamingOutput) {
						streamingOutputMessages.push({
							timestamp,
							type: messageType,
							message,
							threadId: threadId || 'unknown'
						});
					}
					
					// Send to webhook if enabled
					if (streamingOptions.enableStreaming && streamingOptions.webhookUrl) {
						const now = Date.now();
						if (!force && now - lastStreamTime < batchInterval) {
							messageBuffer.push(message);
							return;
						}

						// Send buffered messages
						const messages = messageBuffer.length > 0 ? messageBuffer.join('\n') + '\n' + message : message;
						messageBuffer = [];
						lastStreamTime = now;

						try {
							const webhookPayload: any = {
								text: messages,
							};

							if (streamingOptions.threadTimestamp) {
								webhookPayload.thread_ts = streamingOptions.threadTimestamp;
							}

							await this.helpers.httpRequest({
								method: 'POST',
								url: streamingOptions.webhookUrl,
								body: webhookPayload,
								headers: {
									'Content-Type': 'application/json',
								},
							});

							if (additionalOptions.debug) {
								console.log(`[ClaudeCodeStreaming] Sent streaming update: ${message.substring(0, 100)}...`);
							}
						} catch (error) {
							if (additionalOptions.debug) {
								console.error(`[ClaudeCodeStreaming] Failed to send streaming update:`, error);
							}
						}
					}
				};

				// Send initial streaming update
				if (streamingOptions.enableStreamingOutput || streamingOptions.enableStreaming) {
					await handleStreamingUpdate(`🚀 Starting Claude Code execution: ${prompt.substring(0, 100)}...`, 'start');
				}

				// Execute query
				const messages: SDKMessage[] = [];
				const startTime = Date.now();
				const currentTimestamp = new Date().toISOString();

				try {
					for await (const message of query(queryOptions)) {
						messages.push(message);

						if (additionalOptions.debug) {
							console.log(`[ClaudeCodeStreaming] Received message type: ${message.type}`);
						}

						// Handle streaming based on format
						if (streamingOptions.enableStreaming) {
							switch (streamingOptions.streamFormat) {
								case 'status':
									if (message.type === 'assistant' && message.message?.content) {
										const content = message.message.content[0];
										if (content.type === 'tool_use') {
											await handleStreamingUpdate(`🔧 Using tool: ${content.name}`, 'tool_use');
										}
									}
									break;

								case 'full':
									if (message.type === 'assistant' && message.message?.content) {
										const content = message.message.content[0];
										if (content.type === 'text') {
											await handleStreamingUpdate(`💬 Claude: ${content.text.substring(0, 200)}...`, 'assistant_message');
										} else if (content.type === 'tool_use') {
											await handleStreamingUpdate(`🔧 Tool: ${content.name} - ${JSON.stringify(content.input).substring(0, 100)}...`, 'tool_use_detailed');
										}
									}
									break;

								case 'chunks':
									// Send raw message data for real-time streaming
									await handleStreamingUpdate(`📊 Message: ${JSON.stringify(message).substring(0, 500)}...`, 'raw_message');
									break;
							}
						}

						// Track progress
						if (message.type === 'assistant' && message.message?.content) {
							const content = message.message.content[0];
							if (additionalOptions.debug && content.type === 'text') {
								console.log(`[ClaudeCodeStreaming] Assistant: ${content.text.substring(0, 100)}...`);
							} else if (additionalOptions.debug && content.type === 'tool_use') {
								console.log(`[ClaudeCodeStreaming] Tool use: ${content.name}`);
							}
						}
					}

					clearTimeout(timeoutId);

					const duration = Date.now() - startTime;
					if (additionalOptions.debug) {
						console.log(
							`[ClaudeCodeStreaming] Execution completed in ${duration}ms with ${messages.length} messages`,
						);
					}

					// Send final streaming update
					if (streamingOptions.enableStreamingOutput || streamingOptions.enableStreaming) {
						const resultMessage = messages.find((m) => m.type === 'result') as any;
						const success = resultMessage?.subtype === 'success';
						await handleStreamingUpdate(
							`✅ Claude Code execution ${success ? 'completed successfully' : 'finished'} in ${duration}ms`,
							'completion',
							true
						);
					}

					// Prepare thread data
					const maxHistory = threadManagement.maxThreadHistory || 50;
					let messageHistory = threadData ? [...threadData.messageHistory] : [];
					messageHistory.push(...messages);
					
					// Trim history if it exceeds max
					if (messageHistory.length > maxHistory) {
						messageHistory = messageHistory.slice(-maxHistory);
					}

					// Create or update thread data
					const updatedThreadData: ThreadData = {
						threadId,
						createdAt: threadData?.createdAt || currentTimestamp,
						lastMessageAt: currentTimestamp,
						messageHistory,
						metadata: { ...threadMetadata, ...(threadData?.metadata || {}) },
					};

					// Save thread data
					// Save individual thread data
					staticData[`claude_thread_${updatedThreadData.threadId}`] = updatedThreadData;

					// Update threads list
					const allThreadsKey = 'claude_threads_list';
					let threadsList = (staticData[allThreadsKey] as any[]) || [];
					
					// Remove existing entry if it exists
					threadsList = threadsList.filter((t: any) => t.threadId !== updatedThreadData.threadId);
					
					// Add updated thread info to list
					threadsList.push({
						threadId: updatedThreadData.threadId,
						createdAt: updatedThreadData.createdAt,
						lastMessageAt: updatedThreadData.lastMessageAt,
						messageCount: updatedThreadData.messageHistory.length,
						metadata: updatedThreadData.metadata,
					});

					// Sort by last message time (most recent first)
					threadsList.sort((a: any, b: any) => 
						new Date(b.lastMessageAt).getTime() - new Date(a.lastMessageAt).getTime()
					);

					staticData[allThreadsKey] = threadsList;

					// Format output based on selected format
					if (outputFormat === 'text') {
						// Find the result message
						const resultMessage = messages.find((m) => m.type === 'result') as any;
						returnData.push({
							json: {
								result: resultMessage?.result || resultMessage?.error || '',
								success: resultMessage?.subtype === 'success',
								duration_ms: resultMessage?.duration_ms,
								total_cost_usd: resultMessage?.total_cost_usd,
								threadId,
							},
							pairedItem: itemIndex,
						});
					} else if (outputFormat === 'messages') {
						// Return raw messages
						returnData.push({
							json: {
								messages,
								messageCount: messages.length,
								threadId,
							},
							pairedItem: itemIndex,
						});
					} else if (outputFormat === 'threadInfo') {
						// Return detailed thread information
						returnData.push({
							json: {
								threadId,
								createdAt: updatedThreadData.createdAt,
								lastMessageAt: updatedThreadData.lastMessageAt,
								totalMessages: updatedThreadData.messageHistory.length,
								currentSessionMessages: messages.length,
								metadata: updatedThreadData.metadata,
								messages: threadManagement.includeTimestamps !== false ? messages : messages,
								fullHistory: updatedThreadData.messageHistory,
							},
							pairedItem: itemIndex,
						});
					} else if (outputFormat === 'structured') {
						// Parse into structured format
						const userMessages = messages.filter((m) => m.type === 'user');
						const assistantMessages = messages.filter((m) => m.type === 'assistant');
						const toolUses = messages.filter(
							(m) =>
								m.type === 'assistant' && (m as any).message?.content?.[0]?.type === 'tool_use',
						);
						const systemInit = messages.find(
							(m) => m.type === 'system' && (m as any).subtype === 'init',
						) as any;
						const resultMessage = messages.find((m) => m.type === 'result') as any;

						returnData.push({
							json: {
								threadId,
								threadInfo: {
									createdAt: updatedThreadData.createdAt,
									lastMessageAt: updatedThreadData.lastMessageAt,
									totalMessages: updatedThreadData.messageHistory.length,
									metadata: updatedThreadData.metadata,
								},
								messages,
								summary: {
									userMessageCount: userMessages.length,
									assistantMessageCount: assistantMessages.length,
									toolUseCount: toolUses.length,
									hasResult: !!resultMessage,
									toolsAvailable: systemInit?.tools || [],
								},
								result: resultMessage?.result || resultMessage?.error || null,
								metrics: resultMessage
									? {
											duration_ms: resultMessage.duration_ms,
											num_turns: resultMessage.num_turns,
											total_cost_usd: resultMessage.total_cost_usd,
											usage: resultMessage.usage,
										}
									: null,
								success: resultMessage?.subtype === 'success',
								streaming: {
									enabled: streamingOptions.enableStreaming,
									format: streamingOptions.streamFormat,
									webhookUrl: streamingOptions.webhookUrl ? '[REDACTED]' : null,
								},
							},
							pairedItem: itemIndex,
						});
					}

					// Add streaming messages to output if enabled
					if (streamingOptions.enableStreamingOutput && streamingOutputMessages.length > 0) {
						streamingData.push({
							json: {
								threadId,
								streamingMessages: streamingOutputMessages,
								messageCount: streamingOutputMessages.length,
								executionId: `${threadId}_${Date.now()}`,
								streamingFormat: streamingOptions.streamFormat || 'status'
							},
							pairedItem: itemIndex,
						});
					}
				} catch (queryError) {
					clearTimeout(timeoutId);

					// Send error streaming update
					if (streamingOptions.enableStreamingOutput || streamingOptions.enableStreaming) {
						await handleStreamingUpdate(`❌ Claude Code execution failed: ${queryError instanceof Error ? queryError.message : 'Unknown error'}`, 'error', true);
						
						// Add error streaming messages to output if enabled
						if (streamingOptions.enableStreamingOutput && streamingOutputMessages.length > 0) {
							streamingData.push({
								json: {
									threadId: threadId || 'unknown',
									streamingMessages: streamingOutputMessages,
									messageCount: streamingOutputMessages.length,
									executionId: `error_${Date.now()}`,
									streamingFormat: streamingOptions.streamFormat || 'status',
									error: true
								},
								pairedItem: itemIndex,
							});
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
							errorDetails: error instanceof Error ? error.stack : undefined,
							itemIndex,
						},
						pairedItem: itemIndex,
					});
					continue;
				}

				// Provide more specific error messages
				const userFriendlyMessage = isTimeout
					? `Operation timed out after ${timeout} seconds. Consider increasing the timeout in Additional Options.`
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