#!/usr/bin/env node
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { getConfig } from './config.js';
import { createServer } from './server.js';

const config = getConfig();
const server = createServer(config);
const transport = new StdioServerTransport();
await server.connect(transport);
