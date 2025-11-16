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

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/documents', documentRoutes);
app.use('/api/categories', categoryRoutes);
app.use('/api/departments', departmentRoutes);
app.use('/api/files', fileRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/activities', activityRoutes);
app.use('/api/search', searchRoutes);
app.use('/api/config', configRoutes);

// Health check endpoint
app.get('/api/health', (req, res) => {
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
      docs: 'https://github.com/allouf/Diwan'
    }
  });
});

// Export as serverless function for Vercel
export default (req: VercelRequest, res: VercelResponse) => {
  return app(req, res);
};