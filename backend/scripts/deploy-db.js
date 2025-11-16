#!/usr/bin/env node

// Database deployment script for Vercel
// This script runs during Vercel deployment to sync database schema

const { execSync } = require('child_process');

async function deployDatabase() {
  try {
    console.log('🔧 Starting database deployment...');

    // Generate Prisma client
    console.log('📦 Generating Prisma client...');
    execSync('npx prisma generate', { stdio: 'inherit' });

    // Push schema to database (for now, until migrations are set up)
    console.log('🗄️ Syncing database schema...');
    execSync('npx prisma db push --accept-data-loss', { stdio: 'inherit' });

    console.log('✅ Database deployment completed successfully!');
    console.log('');
    console.log('⚠️  Note: Database seeding must be done manually.');
    console.log('   Run: DATABASE_URL="your-db-url" npm run db:seed');
    console.log('');

  } catch (error) {
    console.error('❌ Database deployment failed:', error.message);
    console.error('');
    console.error('Troubleshooting:');
    console.error('1. Ensure DATABASE_URL environment variable is set in Vercel');
    console.error('2. Check that your database is accessible from Vercel');
    console.error('3. Verify that Prisma schema is correct');
    console.error('');
    process.exit(1);
  }
}

// Run the deployment
deployDatabase();