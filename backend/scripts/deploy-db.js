#!/usr/bin/env node

// Database deployment script for Vercel
// This script will run during Vercel deployment to set up the database

const { execSync } = require('child_process');

async function deployDatabase() {
  try {
    console.log('🔧 Starting database setup...');
    
    // Generate Prisma client
    console.log('📦 Generating Prisma client...');
    execSync('npx prisma generate', { stdio: 'inherit' });
    
    // Push database schema
    console.log('🗄️ Pushing database schema...');
    execSync('npx prisma db push --force-reset', { stdio: 'inherit' });
    
    // Seed the database
    console.log('🌱 Seeding database...');
    execSync('npx prisma db seed', { stdio: 'inherit' });
    
    console.log('✅ Database setup completed successfully!');
    
  } catch (error) {
    console.error('❌ Database setup failed:', error.message);
    
    // If db push fails, try without force-reset (database might already exist)
    try {
      console.log('🔄 Retrying without force-reset...');
      execSync('npx prisma db push', { stdio: 'inherit' });
      
      console.log('🌱 Seeding database...');
      execSync('npx prisma db seed', { stdio: 'inherit' });
      
      console.log('✅ Database setup completed on retry!');
    } catch (retryError) {
      console.error('❌ Database setup failed on retry:', retryError.message);
      process.exit(1);
    }
  }
}

// Run the deployment
deployDatabase();