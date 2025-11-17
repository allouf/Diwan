# ✅ Vercel Deployment - Ready to Deploy!

## 📁 Project Structure

```
cms-mock/
├── api/                    # Vercel serverless functions (root level)
│   └── index.ts           # Main API entry point
├── backend/               # Express backend code
│   ├── api/              # (old location - can be removed)
│   ├── src/              # TypeScript source
│   ├── dist/             # Compiled JavaScript (generated)
│   ├── prisma/           # Database schema & seed
│   └── package.json
└── vercel.json           # Vercel configuration
```

## 🚀 Deploy Now

### 1. Commit Everything
```bash
git add .
git commit -m "Configure Vercel serverless deployment"
git push origin main
```

### 2. Configure Vercel Environment Variables

In your Vercel project dashboard, add:

**Required:**
- `DATABASE_URL` - PostgreSQL connection string
  ```
  postgresql://user:password@host:5432/database?schema=public
  ```

**Recommended:**
- `JWT_SECRET` - Generate with: `openssl rand -base64 32`
- `JWT_REFRESH_SECRET` - Generate with: `openssl rand -base64 32`
- `NODE_ENV` = `production`
- `ALLOWED_ORIGINS` - Your frontend URL (e.g., `https://your-app.vercel.app`)

### 3. Deploy

**Option A: Automatic (GitHub)**
- Push to main branch
- Vercel auto-deploys

**Option B: Manual (CLI)**
```bash
npm install -g vercel
vercel --prod
```

### 4. Seed Database (One-Time Only)

After first successful deployment:

```bash
# Use your production DATABASE_URL
DATABASE_URL="postgresql://..." npm run db:seed --prefix backend
```

Or connect via Vercel CLI:
```bash
vercel env pull .env.production
cd backend
npm run db:seed
```

## 📋 What Happens During Build

1. ✅ Installs backend dependencies
2. ✅ Generates Prisma Client
3. ✅ Compiles TypeScript (`backend/src` → `backend/dist`)
4. ✅ Creates serverless function from `api/index.ts`
5. ✅ Deploys to Vercel

## 🧪 Test Your Deployment

```bash
# Health check
curl https://your-app.vercel.app/api/health

# Should return:
# {
#   "status": "ok",
#   "message": "HIAST CMS API is running",
#   ...
# }
```

## 📝 Default Login Credentials (After Seeding)

**Admin:**
- Email: `admin@hiast.edu.sy`
- Password: `admin123`

**Correspondence Officer:**
- Email: `fatima.sakr@hiast.edu.sy`
- Password: `password123`

⚠️ **Change these passwords immediately in production!**

## 🔧 Troubleshooting

### Build Fails

**Check:**
1. All TypeScript errors are fixed (`npm run build` locally)
2. DATABASE_URL is set in Vercel
3. Prisma schema is committed

### Database Connection Issues

**Check:**
1. DATABASE_URL format is correct
2. Database allows connections from Vercel IPs
3. SSL mode is set if required: `?sslmode=require`

### API Returns 500 Error

**Check Vercel Logs:**
```bash
vercel logs --prod
```

Common issues:
- Missing environment variables
- Database connection failed
- Prisma client not generated

## 📚 Available Endpoints

Once deployed, your API will have:

- `POST /api/auth/login` - User login
- `POST /api/auth/register` - User registration
- `GET /api/documents` - List documents
- `GET /api/departments` - List departments
- `GET /api/users` - List users (admin only)
- `GET /api/dashboard` - Dashboard stats
- And many more...

Full API documentation coming soon!

## 🎉 Success!

Your backend is now running as a serverless function on Vercel!

**Next Steps:**
1. Deploy your frontend
2. Configure CORS to allow your frontend domain
3. Seed the production database
4. Change default passwords
5. Monitor logs and performance

---

**Need Help?** Check the Vercel deployment logs or review this guide.
