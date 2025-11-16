import { Router, Request, Response } from 'express';
import { PrismaClient } from '../generated/prisma';
import { execSync } from 'child_process';
import { authenticateToken } from '../middleware/auth';

const router = Router();
const prisma = new PrismaClient();

// Database setup endpoint - should only be called once during deployment
router.post('/migrate', async (req: Request, res: Response): Promise<void> => {
  try {
    console.log('🔧 Starting database setup...');

    // Check if database is already set up
    try {
      const userCount = await prisma.user.count();
      if (userCount > 0) {
        res.json({
          success: true,
          message: 'Database already set up',
          userCount
        });
        return;
      }
    } catch (error) {
      console.log('Database not set up yet, proceeding with migration...');
    }

    // Generate Prisma client
    console.log('📦 Generating Prisma client...');
    execSync('npx prisma generate', { 
      stdio: 'inherit',
      cwd: process.cwd()
    });

    // Push database schema
    console.log('🗄️ Pushing database schema...');
    execSync('npx prisma db push', { 
      stdio: 'inherit',
      cwd: process.cwd()
    });

    // Seed the database
    console.log('🌱 Seeding database...');
    execSync('npx prisma db seed', { 
      stdio: 'inherit',
      cwd: process.cwd()
    });

    // Verify setup
    const finalUserCount = await prisma.user.count();
    const departmentCount = await prisma.department.count();
    const categoryCount = await prisma.category.count();

    console.log('✅ Database setup completed successfully!');

    res.json({ 
      success: true, 
      message: 'Database migrated and seeded successfully',
      stats: {
        users: finalUserCount,
        departments: departmentCount,
        categories: categoryCount
      }
    });

  } catch (error: any) {
    console.error('❌ Database setup failed:', error.message);
    res.status(500).json({ 
      success: false, 
      error: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
});

// Health check endpoint
router.get('/health', async (req: Request, res: Response) => {
  try {
    // Test database connection
    await prisma.$queryRaw`SELECT 1`;
    
    // Get basic stats
    const stats: {
      database: string;
      timestamp: string;
      environment: string;
      users?: number | string;
    } = {
      database: 'connected',
      timestamp: new Date().toISOString(),
      environment: process.env.NODE_ENV || 'unknown'
    };

    // Try to get user count (if database is set up)
    try {
      const userCount = await prisma.user.count();
      stats.users = userCount;
    } catch (error) {
      stats.users = 'not_migrated';
    }

    res.json({
      success: true,
      message: 'System is healthy',
      ...stats
    });

  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: 'Database connection failed',
      error: error.message
    });
  }
});

// Reset database endpoint (development only)
router.post('/reset', async (req: Request, res: Response): Promise<void> => {
  if (process.env.NODE_ENV === 'production') {
    res.status(403).json({
      success: false,
      message: 'Reset not allowed in production'
    });
    return;
  }

  try {
    console.log('🔄 Resetting database...');

    execSync('npx prisma db push --force-reset', {
      stdio: 'inherit',
      cwd: process.cwd()
    });

    execSync('npx prisma db seed', {
      stdio: 'inherit',
      cwd: process.cwd()
    });

    res.json({
      success: true,
      message: 'Database reset successfully'
    });

  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

export default router;