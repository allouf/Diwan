import { VercelRequest, VercelResponse } from '@vercel/node';
import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';

// Import your existing Express app setup
import authRoutes from '../src/routes/auth';
import userRoutes from '../src/routes/users';
import documentRoutes from '../src/routes/documents';
import categoryRoutes from '../src/routes/categories';
import departmentRoutes from '../src/routes/departments';
import fileRoutes from '../src/routes/files';
import dashboardRoutes from '../src/routes/dashboard';
import notificationRoutes from '../src/routes/notifications';
import activityRoutes from '../src/routes/activities';
import searchRoutes from '../src/routes/search';
import configRoutes from '../src/routes/config';

// Load environment variables
dotenv.config();

const app = express();

// Middleware
app.use(cors({
  origin: process.env.FRONTEND_URL || '*',
  credentials: true
}));

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// API Routes - Note: /api prefix is handled by Vercel routing
app.use('/auth', authRoutes);
app.use('/users', userRoutes);
app.use('/documents', documentRoutes);
app.use('/categories', categoryRoutes);
app.use('/departments', departmentRoutes);
app.use('/files', fileRoutes);
app.use('/dashboard', dashboardRoutes);
app.use('/notifications', notificationRoutes);
app.use('/activities', activityRoutes);
app.use('/search', searchRoutes);
app.use('/config', configRoutes);

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development'
  });
});

// Root endpoint
app.get('/', (req, res) => {
  res.json({ 
    message: 'HIAST CMS API is running',
    version: '1.0.0',
    endpoints: {
      health: '/api/health',
      auth: '/api/auth',
      users: '/api/users',
      documents: '/api/documents',
      dashboard: '/api/dashboard',
      setup: '/api/setup-db',
      docs: 'https://github.com/allouf/Diwan'
    }
  });
});

// Export as serverless function for Vercel
export default (req: VercelRequest, res: VercelResponse) => {
  return app(req, res);
};