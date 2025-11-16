import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { createServer } from 'http';
import { Server } from 'socket.io';
import path from 'path';

// Load environment variables
dotenv.config();

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
const io = new Server(server, {
  cors: {
    origin: process.env.ALLOWED_ORIGINS?.split(',') || ['http://localhost:3000'],
    credentials: true
  }
});

const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors({
  origin: process.env.ALLOWED_ORIGINS?.split(',') || ['http://localhost:3000'],
  credentials: true
}));

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Request logging
app.use(requestLogger);

// Static file serving for uploads
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.status(200).json({
    status: 'OK',
    message: 'CMS Backend Server is running',
    timestamp: new Date().toISOString(),
    version: '1.0.0'
  });
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

// Start server
server.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`📱 Environment: ${process.env.NODE_ENV}`);
  console.log(`🔗 Health check: http://localhost:${PORT}/api/health`);
  console.log(`📂 File uploads: /api/files/upload`);
});
