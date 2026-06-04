const readline = require('readline');
const { createBooking, getBooking, cancelBooking } = require('../controllers/bookingController');
const { createOrder, getProducts } = require('../controllers/orderController');

const tools = [
  {
    name: 'create_booking',
    description: 'Create a rice milling booking',
    inputSchema: {
      type: 'object',
      properties: {
        lineUserId: { type: 'string' },
        name: { type: 'string' },
        phone: { type: 'string' },
        riceType: { type: 'string' },
        quantityKg: { type: 'number' },
        desiredDate: { type: 'string' },
        dropoffTime: { type: 'string' },
        note: { type: 'string' },
      },
      required: ['lineUserId', 'name', 'phone', 'riceType', 'quantityKg', 'desiredDate', 'dropoffTime'],
    },
  },
  {
    name: 'get_booking',
    description: 'Get a booking by booking number, line user ID, or phone',
    inputSchema: {
      type: 'object',
      properties: {
        bookingNumber: { type: 'string' },
        lineUserId: { type: 'string' },
        phone: { type: 'string' },
      },
    },
  },
  {
    name: 'cancel_booking',
    description: 'Cancel a booking',
    inputSchema: {
      type: 'object',
      properties: {
        bookingNumber: { type: 'string' },
        lineUserId: { type: 'string' },
        reason: { type: 'string' },
      },
    },
  },
  {
    name: 'create_order',
    description: 'Create a product order',
    inputSchema: {
      type: 'object',
      properties: {
        lineUserId: { type: 'string' },
        productName: { type: 'string' },
        quantity: { type: 'number' },
        customerName: { type: 'string' },
        phone: { type: 'string' },
        address: { type: 'string' },
        note: { type: 'string' },
      },
      required: ['lineUserId', 'productName', 'quantity', 'customerName', 'phone', 'address'],
    },
  },
  {
    name: 'get_products',
    description: 'Get available products',
    inputSchema: {
      type: 'object',
      properties: {
        search: { type: 'string' },
        category: { type: 'string' },
        limit: { type: 'number' },
      },
    },
  },
];

async function handleTool(name, args = {}) {
  if (name === 'create_booking') return createBooking(args);
  if (name === 'get_booking') return getBooking(args);
  if (name === 'cancel_booking') return cancelBooking(args);
  if (name === 'create_order') return createOrder(args);
  if (name === 'get_products') return getProducts(args);

  const error = new Error(`Unknown tool: ${name}`);
  error.statusCode = 404;
  throw error;
}

async function handleRpc(request) {
  if (!request || typeof request !== 'object') return null;

  const { id, method, params = {} } = request;

  if (method === 'initialize') {
    return {
      jsonrpc: '2.0',
      id,
      result: {
        protocolVersion: '2024-11-05',
        serverInfo: { name: 'rice-mill-chatbot-mcp', version: '1.0.0' },
        capabilities: { tools: {} },
      },
    };
  }

  if (method === 'tools/list') {
    return { jsonrpc: '2.0', id, result: { tools } };
  }

  if (method === 'tools/call') {
    const result = await handleTool(params.name, params.arguments || {});
    return {
      jsonrpc: '2.0',
      id,
      result: {
        content: [{ type: 'text', text: typeof result === 'string' ? result : JSON.stringify(result, null, 2) }],
      },
    };
  }

  return {
    jsonrpc: '2.0',
    id,
    error: { code: -32601, message: `Method not found: ${method}` },
  };
}

function startStdioServer() {
  const rl = readline.createInterface({ input: process.stdin, crlfDelay: Infinity });

  rl.on('line', async (line) => {
    const trimmed = String(line || '').trim();
    if (!trimmed) return;

    try {
      const request = JSON.parse(trimmed);
      const response = await handleRpc(request);
      if (response) process.stdout.write(`${JSON.stringify(response)}\n`);
    } catch (error) {
      process.stdout.write(`${JSON.stringify({ jsonrpc: '2.0', id: null, error: { code: -32700, message: error.message || 'Parse error' } })}\n`);
    }
  });
}

if (require.main === module) {
  startStdioServer();
}

module.exports = {
  handleRpc,
  handleTool,
  startStdioServer,
  tools,
};