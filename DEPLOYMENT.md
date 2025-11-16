# Vercel Deployment Guide

This guide will help you deploy the HIAST CMS to Vercel and set up the PostgreSQL database.

## 📋 Prerequisites

- [x] Vercel account with PostgreSQL database created
- [x] GitHub repository with the project code
- [x] Database connection strings from Vercel

## 🚀 Deployment Steps

### 1. Environment Variables Setup

In your Vercel dashboard, add these environment variables:

```bash
# Database Configuration
DATABASE_URL=postgres://c4c3f612e8aa67fb44f26fe87e9c08351ac2bf21e1d23efdb5b28c230a8cf790:sk_ehVKSHhLyNuP3aJSAjVWJ@db.prisma.io:5432/postgres?sslmode=require

# JWT Configuration
JWT_SECRET=hiast-cms-super-secure-jwt-secret-key-2024-vercel
JWT_REFRESH_SECRET=hiast-cms-refresh-secret-key-2024-vercel

# Server Configuration
NODE_ENV=production
PORT=3001

# File Upload Configuration
MAX_FILE_SIZE=10485760
UPLOAD_DIR=uploads

# CORS Configuration (replace with your actual frontend URL)
FRONTEND_URL=https://your-vercel-app-name.vercel.app
ALLOWED_ORIGINS=https://your-vercel-app-name.vercel.app
```

### 2. Deploy to Vercel

1. Connect your GitHub repository to Vercel
2. Vercel will automatically detect the configuration from `vercel.json`
3. The deployment will build both backend and frontend

### 3. Database Migration (Run from Vercel Functions)

Once deployed, you need to run the database migration from the Vercel environment:

#### Option A: Using Vercel CLI (Recommended)
```bash
# Install Vercel CLI if you haven't already
npm i -g vercel

# Login to Vercel
vercel login

# Link your project
vercel link

# Run database setup commands
vercel env pull .env.local
cd backend
npx prisma generate
npx prisma db push
npx prisma db seed
```

#### Option B: Using Vercel Dashboard
1. Go to your Vercel project dashboard
2. Navigate to the "Functions" tab
3. Find your backend function
4. Use the "Logs" to monitor the deployment
5. If the auto-deployment didn't run migrations, create a temporary API endpoint:

Create `backend/src/routes/setup.ts`:
```typescript
import { Router } from 'express';
import { PrismaClient } from '../generated/prisma';
import { execSync } from 'child_process';

const router = Router();

router.post('/migrate', async (req, res) => {
  try {
    // Run migrations
    execSync('npx prisma db push', { stdio: 'inherit' });
    execSync('npx prisma db seed', { stdio: 'inherit' });
    
    res.json({ success: true, message: 'Database migrated successfully' });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

export default router;
```

Then call `POST https://your-app.vercel.app/api/setup/migrate` once.

#### Option C: Automatic Migration Script
The project includes `backend/scripts/deploy-db.js` which should run automatically during deployment.

### 4. Verify Database Setup

Check if the database is properly set up:

1. Go to `https://your-app.vercel.app/api/health` (if health endpoint exists)
2. Try logging in with default credentials:
   - **Admin**: admin@hiast.edu.sy / admin123
   - **User**: fatima.sakr@hiast.edu.sy / password123

### 5. Frontend Configuration

Update the frontend environment variables in Vercel:

```bash
VITE_API_BASE_URL=https://your-backend-app.vercel.app/api
VITE_SOCKET_URL=https://your-backend-app.vercel.app
```

## 🔧 Troubleshooting

### Database Connection Issues
- Verify the DATABASE_URL is correct in Vercel environment variables
- Check that SSL is enabled (sslmode=require)
- Ensure the database is accessible from Vercel's servers

### Migration Failures
- Check Vercel function logs for detailed error messages
- Verify Prisma schema is valid: `npx prisma validate`
- Try manual migration using temporary API endpoint

### Build Failures
- Check that all dependencies are listed in package.json
- Verify TypeScript compilation: `npm run build`
- Check Vercel build logs for specific errors

## 📁 Project Structure After Deployment

```
Vercel Deployment:
├── Backend Function: /api/*
├── Frontend Static: /*
├── Database: PostgreSQL (Vercel)
└── File Storage: Vercel Blob (recommended for production)
```

## 🎯 Post-Deployment Tasks

1. **Update CORS settings** with your actual domain
2. **Configure file storage** (consider Vercel Blob for production)
3. **Set up monitoring** and error tracking
4. **Test all functionality** with real users
5. **Set up backup strategy** for database

## 🔐 Security Checklist

- [x] Environment variables are set in Vercel dashboard (not in code)
- [x] JWT secrets are strong and unique
- [x] Database credentials are secure
- [x] CORS is configured for your domain only
- [ ] File upload restrictions are in place
- [ ] Rate limiting is configured (consider adding)
- [ ] HTTPS is enabled (automatic with Vercel)

## 📞 Support

If you encounter issues:
1. Check Vercel function logs
2. Review this deployment guide
3. Check the main README.md for development setup
4. Contact the development team

---

**Next Steps**: After successful deployment, test the system thoroughly and update the production environment variables as needed.