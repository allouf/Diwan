import { VercelRequest, VercelResponse } from '@vercel/node';
import { execSync } from 'child_process';
import { PrismaClient } from '../src/generated/prisma';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Only allow POST requests
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    console.log('🔧 Starting database setup...');

    // Initialize Prisma client
    const prisma = new PrismaClient();

    // Check if database is already set up
    try {
      const userCount = await prisma.user.count();
      if (userCount > 0) {
        return res.json({ 
          success: true, 
          message: 'Database already set up',
          userCount,
          alreadySetup: true
        });
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

    await prisma.$disconnect();

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
}