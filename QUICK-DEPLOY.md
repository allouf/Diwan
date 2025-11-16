# 🚀 Quick Vercel Deployment Guide

## Deploy Backend (API) First

1. **Create new project in Vercel dashboard**
   - Import from GitHub: `https://github.com/allouf/Diwan`
   - **Root Directory**: `backend`
   - **Framework Preset**: Other
   - Vercel will detect the `backend/vercel.json` configuration

2. **Set Environment Variables in Vercel Dashboard**:
   ```
   DATABASE_URL=postgres://c4c3f612e8aa67fb44f26fe87e9c08351ac2bf21e1d23efdb5b28c230a8cf790:sk_ehVKSHhLyNuP3aJSAjVWJ@db.prisma.io:5432/postgres?sslmode=require
   JWT_SECRET=hiast-cms-super-secure-jwt-secret-key-2024-vercel
   JWT_REFRESH_SECRET=hiast-cms-refresh-secret-key-2024-vercel
   NODE_ENV=production
   PORT=3001
   ```

3. **Deploy and test backend**
   - Deployment URL will be something like: `https://hiast-cms-backend.vercel.app`
   - Test: `https://your-backend-url.vercel.app/api/health` (once we add health endpoint)

## Deploy Frontend

1. **Create another project in Vercel dashboard**
   - Import from GitHub: `https://github.com/allouf/Diwan` (same repo)
   - **Root Directory**: `frontend`
   - **Framework Preset**: Create React App
   - Vercel will detect the `frontend/vercel.json` configuration

2. **Set Environment Variables for Frontend**:
   ```
   VITE_API_BASE_URL=https://your-backend-url.vercel.app/api
   REACT_APP_API_URL=https://your-backend-url.vercel.app/api
   ```

3. **Deploy frontend**
   - Deployment URL will be: `https://hiast-cms-frontend.vercel.app`

## Setup Database (Run from Backend)

After both are deployed, initialize the database:

### Option 1: Create Setup Endpoint (Recommended)
1. Add this to your backend `src/index.ts` temporarily:

```typescript
// Add this route for one-time database setup
app.post('/api/setup-db', async (req, res) => {
  try {
    const { execSync } = require('child_process');
    
    // Generate Prisma client
    execSync('npx prisma generate');
    
    // Push schema to database
    execSync('npx prisma db push');
    
    // Seed database
    execSync('npx prisma db seed');
    
    res.json({ success: true, message: 'Database setup complete!' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
```

2. Call the endpoint: `POST https://your-backend-url.vercel.app/api/setup-db`

3. Remove the endpoint after successful setup

### Option 2: Use Vercel CLI
```bash
npm i -g vercel
vercel login
cd backend
vercel env pull .env.local
npx prisma generate
npx prisma db push
npx prisma db seed
```

## Test the System

1. **Backend Health Check**: `GET https://your-backend-url.vercel.app/api/health`
2. **Frontend Access**: `https://your-frontend-url.vercel.app`
3. **Login with default credentials**:
   - Email: `admin@hiast.edu.sy`
   - Password: `admin123`

## Update Frontend API URL

Once backend is deployed, update the frontend environment variables with the actual backend URL.

## 🎉 You're Done!

Your HIAST CMS should now be fully deployed and functional on Vercel!

## 🐛 Troubleshooting

- **Backend Build Issues**: Check Vercel function logs in dashboard
- **Database Connection**: Verify DATABASE_URL is correct
- **CORS Issues**: Update CORS settings in backend with frontend URL
- **Build Failures**: Check that all dependencies are in package.json

---
**Remember**: This is a production deployment, so handle the database setup carefully!