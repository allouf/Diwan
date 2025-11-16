import { VercelRequest, VercelResponse } from '@vercel/node';
import app from '../dist/index';

export default async (req: VercelRequest, res: VercelResponse) => {
  // Use the Express app as a request handler
  return app(req as any, res as any);
};
