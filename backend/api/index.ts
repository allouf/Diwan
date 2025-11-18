import { VercelRequest, VercelResponse } from '@vercel/node';

// Import the compiled Express app
let app: any;

const loadApp = async () => {
  if (!app) {
    console.log('🔄 Loading Express app...');
    // Use relative path to the built app
    const module = await import('../dist/index.js');
    app = module.default;
  }
  return app;
};

// Enhanced CORS configuration
const allowedOrigins = [
  'https://diwan-ochre.vercel.app',
  'http://localhost:3000', 
  'http://localhost:3001'
];

export default async (req: VercelRequest, res: VercelResponse) => {
  const origin = req.headers.origin;
  
  // Set CORS headers for all responses
  if (origin && allowedOrigins.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  } else {
    // Default to your frontend URL
    res.setHeader('Access-Control-Allow-Origin', 'https://diwan-ochre.vercel.app');
  }
  
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS, PATCH');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With, Accept');
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Max-Age', '86400'); // 24 hours

  // Handle OPTIONS requests (CORS preflight) immediately
  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  try {
    const expressApp = await loadApp();
    return expressApp(req, res);
  } catch (error: any) {
    console.error('❌ Error loading Express app:', error);
    
    return res.status(500).json({
      error: 'Internal Server Error',
      message: error.message,
      timestamp: new Date().toISOString()
    });
  }
};