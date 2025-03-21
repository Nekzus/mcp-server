#!/usr/bin/env node

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import type { Tool } from '@modelcontextprotocol/sdk/types.js';
import 'dotenv/config';
import { z } from 'zod';
import availableTools from './tools/index.js';
import { type JsonSchema, schemaConverter } from './utils/schema.js';

type ToolHandler = (
	args: Record<string, unknown>,
	extra: Record<string, unknown>,
) => Promise<unknown>;

export class McpUtilityServer {
	private readonly server: Server;
	private readonly transport: StdioServerTransport;
	private readonly tools: readonly Tool[];

	constructor() {
		this.server = new Server(
			{
				name: '@nekzus/mcp-server',
				version: '1.0.0',
				description:
					'MCP Server implementation providing utility functions and tools for development and testing',
			},
			{
				capabilities: {
					resources: {},
					tools: {},
				},
			},
		);

		this.transport = new StdioServerTransport();
		this.tools = availableTools;

		// Registrar el método tools/list
		this.server.setRequestHandler(
			z.object({
				method: z.literal('tools/list'),
				params: z.object({}).optional(),
			}),
			async () => {
				return {
					tools: this.tools.map((tool) => ({
						name: tool.name,
						description: tool.description,
						schema: tool.inputSchema,
					})),
				};
			},
		);
	}

	private registerTool(tool: Tool): void {
		try {
			console.log(`[Tool Registration] Registering tool: ${tool.name}`);
			const zodSchema = schemaConverter.toZod(tool.inputSchema as JsonSchema);
			const handler = tool.handler as ToolHandler;

			// Registrar el método de la herramienta
			this.server.setRequestHandler(
				z.object({
					method: z.literal('tool'),
					params: z.object({
						name: z.literal(tool.name),
						arguments: zodSchema,
					}),
				}),
				async (request) => {
					const result = await handler(request.params.arguments, {});
					return {
						content: [
							{
								type: 'text',
								text: JSON.stringify(result),
							},
						],
					};
				},
			);
			console.log(`[Tool Registration] Successfully registered: ${tool.name}`);
		} catch (error) {
			console.error(`[Tool Registration] Failed to register tool ${tool.name}:`, error);
			throw error;
		}
	}

	private initializeTools(): void {
		console.log(`[Server] Initializing ${this.tools.length} tools...`);
		for (const tool of this.tools) {
			this.registerTool(tool);
		}
		console.log('[Server] Tool initialization completed successfully');
	}

	public async start(): Promise<void> {
		try {
			this.initializeTools();
			await this.server.connect(this.transport);
			console.log('[Server] MCP Utility Server is running');
			console.log('[Server] Available tools:', this.tools.map((t) => t.name).join(', '));

			// Handle termination signals
			process.on('SIGTERM', () => this.cleanup());
			process.on('SIGINT', () => this.cleanup());

			// Handle stdin close
			process.stdin.on('close', () => {
				console.log('[Server] Input stream closed');
				this.cleanup();
			});
		} catch (error) {
			console.error('[Server] Failed to start MCP Utility Server:', error);
			throw error;
		}
	}

	private async cleanup(): Promise<void> {
		try {
			await this.transport.close();
			console.log('[Server] MCP Utility Server stopped gracefully');
			process.exit(0);
		} catch (error) {
			console.error('[Server] Error during cleanup:', error);
			process.exit(1);
		}
	}
}

// Auto-start server if this is the main module
if (import.meta.url === new URL(import.meta.url).href) {
	const server = new McpUtilityServer();
	server.start().catch((error) => {
		console.error('[Server] Fatal error:', error);
		process.exit(1);
	});
}
