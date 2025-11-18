import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { createServer } from 'http';
import { Server } from 'socket.io';
import path from 'path';

// Load environment variables
dotenv.config();

import prisma from './lib/prisma';
import { errorHandler } from './middleware/errorHandler';
import { requestLogger } from './middleware/requestLogger';

// Routes
import authRoutes from './routes/auth';
import documentRoutes from './routes/documents';
import departmentRoutes from './routes/departments';
import categoryRoutes from './routes/categories';
import dashboardRoutes from './routes/dashboard';
import notificationRoutes from './routes/notifications';
import userRoutes from './routes/users';
import statusRoutes from './routes/status';
import searchRoutes from './routes/search';
import activityRoutes from './routes/activities';
import configRoutes from './routes/config';
import fileRoutes from './routes/files';
import { fileCleanupService } from './lib/fileCleanup';
import { ensureDirectoriesExist } from './lib/fileStorage';

const app = express();
const server = createServer(app);

// Enhanced CORS Configuration
const allowedOrigins = process.env.ALLOWED_ORIGINS?.split(',').map(origin => origin.trim()) || [
  'https://diwan-ochre.vercel.app',
  'http://localhost:3000',
  'http://localhost:3001'
];

console.log('🚀 Allowed CORS origins:', allowedOrigins);

const corsOptions = {
  origin: function (origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) {
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) return callback(null, true);
    
    if (allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      console.log('❌ Blocked by CORS:', origin);
      callback(new Error(`Not allowed by CORS: ${origin}`));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept']
};

// Apply CORS middleware
app.use(cors(corsOptions));

// Explicit OPTIONS handler for all routes
app.options('*', cors(corsOptions));

// Socket.IO with CORS
const io = new Server(server, {
  cors: {
    origin: allowedOrigins,
    credentials: true
  }
});

const PORT = process.env.PORT || 5000;

// Middleware
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Request logging
app.use(requestLogger);

// Static file serving for uploads
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// CORS Test Endpoint (for debugging)
app.get('/api/cors-test', (req, res) => {
  res.json({ 
    message: 'CORS test successful',
    origin: req.headers.origin,
    allowedOrigins: allowedOrigins,
    timestamp: new Date().toISOString()
  });
});

// Health check endpoint with database status
app.get('/api/health', async (req, res) => {
  try {
    // Check database connectivity
    await prisma.$queryRaw`SELECT 1`;

    // Get database stats
    const [userCount, documentCount, departmentCount] = await Promise.all([
      prisma.user.count(),
      prisma.document.count(),
      prisma.department.count()
    ]);

    res.status(200).json({
      status: 'OK',
      message: 'HIAST CMS API is running',
      timestamp: new Date().toISOString(),
      version: '1.0.0',
      database: {
        status: 'connected',
        stats: {
          users: userCount,
          documents: documentCount,
          departments: departmentCount
        }
      }
    });
  } catch (error) {
    res.status(503).json({
      status: 'ERROR',
      message: 'Database connection failed',
      timestamp: new Date().toISOString(),
      database: {
        status: 'disconnected',
        error: error instanceof Error ? error.message : 'Unknown error'
      }
    });
  }
});

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/documents', documentRoutes);
app.use('/api/departments', departmentRoutes);
app.use('/api/categories', categoryRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/users', userRoutes);
app.use('/api/status', statusRoutes);
app.use('/api/search', searchRoutes);
app.use('/api/activities', activityRoutes);
app.use('/api/config', configRoutes);
app.use('/api/files', fileRoutes);

// Socket.IO configuration
io.on('connection', (socket) => {
  console.log('User connected:', socket.id);

  // Join user to their department room
  socket.on('join-department', (departmentId: string) => {
    socket.join(`department-${departmentId}`);
    console.log(`User ${socket.id} joined department-${departmentId}`);
  });

  // Handle user disconnect
  socket.on('disconnect', () => {
    console.log('User disconnected:', socket.id);
  });
});

// Store io instance globally for use in controllers
declare global {
  var io: Server;
}
global.io = io;

// Error handling middleware (should be last)
app.use(errorHandler);

// Initialize file storage
ensureDirectoriesExist().then(() => {
  console.log('📁 File storage directories initialized');
  
  // Start file cleanup service (runs every 24 hours)
  fileCleanupService.startAutomaticCleanup(24);
  console.log('🧹 File cleanup service started');
}).catch(error => {
  console.error('❌ Failed to initialize file storage:', error);
});

// Start server (only in non-serverless environment)
if (process.env.VERCEL !== '1') {
  server.listen(PORT, () => {
    console.log(`🚀 Server running on port ${PORT}`);
    console.log(`📱 Environment: ${process.env.NODE_ENV}`);
    console.log(`🔗 Health check: http://localhost:${PORT}/api/health`);
    console.log(`📂 File uploads: /api/files/upload`);
    console.log(`🎯 CORS test: http://localhost:${PORT}/api/cors-test`);
  });
}

// Export app for serverless deployment
export default app;