import { VercelRequest, VercelResponse } from '@vercel/node';

// Import the compiled Express app
let app: any;

const loadApp = async () => {
  if (!app) {
    const module = await import('../dist/index');
    app = module.default;
  }
  return app;
};

// Handle CORS preflight requests explicitly
export default async (req: VercelRequest, res: VercelResponse) => {
  // Handle OPTIONS requests (CORS preflight) immediately
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Origin', 'https://diwan-ochre.vercel.app');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS, PATCH');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With, Accept');
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    return res.status(204).end();
  }

  try {
    const expressApp = await loadApp();
    return expressApp(req, res);
  } catch (error: any) {
    console.error('Error loading Express app:', error);
    
    // Ensure CORS headers even on errors
    res.setHeader('Access-Control-Allow-Origin', 'https://diwan-ochre.vercel.app');
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    
    return res.status(500).json({
      error: 'Internal Server Error',
      message: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
};