import { VercelRequest, VercelResponse } from '@vercel/node';

export default async (req: VercelRequest, res: VercelResponse) => {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization');

  // Handle preflight requests
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  try {
    const { pathname } = new URL(req.url!, 'http://localhost');

    // Health endpoint
    if (pathname === '/health' || pathname === '/api/health') {
      return res.status(200).json({
        status: 'ok',
        timestamp: new Date().toISOString(),
        environment: process.env.NODE_ENV || 'production',
        message: 'HIAST CMS API is running'
      });
    }

    // Root endpoint
    if (pathname === '/' || pathname === '/api') {
      return res.status(200).json({
        message: 'HIAST CMS API is running',
        version: '1.0.0',
        endpoints: {
          health: '/api/health',
          setup: '/api/setup-db',
          auth: '/api/auth (not implemented yet)',
          docs: 'https://github.com/allouf/Diwan'
        },
        status: 'Basic API working - Full routes coming soon'
      });
    }

    // Default response for other paths
    return res.status(404).json({
      error: 'Endpoint not found',
      path: pathname,
      message: 'API is in basic mode - Full routes coming soon'
    });

  } catch (error: any) {
    console.error('API Error:', error);
    return res.status(500).json({
      error: 'Internal server error',
      message: error.message
    });
  }
};
