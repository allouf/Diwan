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

export default async (req: VercelRequest, res: VercelResponse) => {
  try {
    const expressApp = await loadApp();
    return expressApp(req, res);
  } catch (error: any) {
    console.error('Error loading Express app:', error);
    return res.status(500).json({
      error: 'Internal Server Error',
      message: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
};
