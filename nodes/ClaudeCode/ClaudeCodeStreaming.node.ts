import type {
	IExecuteFunctions,
	INodeExecutionData,
	INodeType,
	INodeTypeDescription,
} from 'n8n-workflow';
import { NodeConnectionType, NodeOperationError } from 'n8n-workflow';
import { query, type SDKMessage } from '@anthropic-ai/claude-code';
import * as crypto from 'crypto';

// Interface for structured block messages
interface BlockMessage {
	type: 'text' | 'code' | 'tool_use' | 'tool_result' | 'error' | 'status';
	content: string;
	timestamp: string;
	metadata?: Record<string, any>;
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
				displayName: 'Simplify',
				name: 'simplify',
				type: 'boolean',
				default: false,
				description: 'Whether to return a simplified version of the response instead of the raw data',
				displayOptions: {
					show: {
						outputFormat: ['structured', 'threadInfo'],
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
			let timeout = 300; // Default timeout
			try {
				const prompt = this.getNodeParameter('prompt', itemIndex) as string;
				const model = this.getNodeParameter('model', itemIndex) as string;
				const maxTurns = this.getNodeParameter('maxTurns', itemIndex) as number;
				timeout = this.getNodeParameter('timeout', itemIndex) as number;
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

				// Log start
				if (additionalOptions.debug) {
					console.log(`[ClaudeCodeStreaming] Starting execution for item ${itemIndex}`);
					console.log(`[ClaudeCodeStreaming] Prompt: ${prompt.substring(0, 100)}...`);
					console.log(`[ClaudeCodeStreaming] Model: ${model}`);
					console.log(`[ClaudeCodeStreaming] Max turns: ${maxTurns}`);
					console.log(`[ClaudeCodeStreaming] Timeout: ${timeout}s`);
					console.log(`[ClaudeCodeStreaming] Allowed built-in tools: ${allowedTools.join(', ')}`);
					console.log(`[ClaudeCodeStreaming] Streaming enabled: ${streamingOptions.enableStreaming}`);
				}

				// Build query options - simplified for single thread operation
				interface QueryOptions {
					prompt: string;
					abortController: AbortController;
					options: {
						maxTurns: number;
						permissionMode: 'default' | 'bypassPermissions';
						model: string;
						systemPrompt?: string;
						allowedTools?: string[];
						cwd?: string;
						continue?: boolean;
					};
				}

				const queryOptions: QueryOptions = {
					prompt,
					abortController,
					options: {
						maxTurns,
						permissionMode: additionalOptions.requirePermissions ? 'default' : 'bypassPermissions',
						model,
						continue: true, // Always continue conversation thread
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

				// Initialize block message streaming
				const blockMessages: BlockMessage[] = [];
				
				// Helper function to convert SDK messages to block messages
				const createBlockMessage = (type: BlockMessage['type'], content: string, metadata?: Record<string, any>): BlockMessage => {
					return {
						type,
						content,
						timestamp: streamingOptions.includeTimestamps !== false ? new Date().toISOString() : '',
						metadata: metadata || {},
					};
				};

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
						// Return thread information
						if (simplify) {
							// Simplified thread info with max 10 most useful fields
							returnData.push({
								json: {
									threadId,
									createdAt: updatedThreadData.createdAt,
									lastMessageAt: updatedThreadData.lastMessageAt,
									totalMessages: updatedThreadData.messageHistory.length,
									currentSessionMessages: messages.length,
									messagesSample: messages.slice(-3), // Last 3 messages only
								},
								pairedItem: itemIndex,
							});
						} else {
							// Full thread information
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
						}
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

						if (simplify) {
							// Simplified output with max 10 most useful fields
							returnData.push({
								json: {
									threadId,
									result: resultMessage?.result || resultMessage?.error || null,
									success: resultMessage?.subtype === 'success',
									createdAt: updatedThreadData.createdAt,
									lastMessageAt: updatedThreadData.lastMessageAt,
									totalMessages: updatedThreadData.messageHistory.length,
									userMessageCount: userMessages.length,
									assistantMessageCount: assistantMessages.length,
									toolUseCount: toolUses.length,
									duration_ms: resultMessage?.duration_ms || null,
								},
								pairedItem: itemIndex,
							});
						} else {
							// Full structured output
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