# Backend Deployment Guide

## ✅ Pre-Deployment Checklist

Your backend is now properly configured for Vercel deployment with Prisma migrations!

### What's Been Set Up:

1. ✅ **Prisma Migrations** - Database schema changes are tracked via migrations
2. ✅ **Build Scripts** - Proper scripts for production deployment
3. ✅ **Vercel Configuration** - vercel.json configured for backend deployment
4. ✅ **Seed File** - Clean seed data ready for initial database population

---

## 🚀 Deployment Steps

### 1. Commit Your Changes

```bash
# Add all migration files and configuration
git add backend/prisma/migrations/
git add backend/package.json
git add backend/scripts/deploy-db.js
git add backend/prisma/seed.ts
git add vercel.json

# Commit
git commit -m "Add production-ready Prisma migrations and deployment config"

# Push to your repository
git push origin main
```

### 2. Configure Vercel Environment Variables

Before deploying, set these environment variables in your Vercel project dashboard:

**Required:**
- `DATABASE_URL` - Your PostgreSQL connection string
  - Example: `postgresql://user:password@host:5432/database?schema=public`
  - For Vercel Postgres: Use the connection string from Vercel Storage

**Recommended:**
- `JWT_SECRET` - Secret key for JWT tokens (generate a strong random string)
- `JWT_REFRESH_SECRET` - Secret for refresh tokens
- `NODE_ENV` - Set to `production`
- `PORT` - Set to `3000` (or your preferred port)

**Optional:**
- `REFERENCE_NUMBER_PREFIX` - Document reference prefix (default: "HIAST")
- `REFERENCE_NUMBER_YEAR` - Year for reference numbers (default: current year)

### 3. Deploy to Vercel

**Option A: Via Vercel CLI**
```bash
npm install -g vercel
vercel --prod
```

**Option B: Via GitHub Integration**
- Push your code to GitHub
- Vercel will automatically deploy when you push to main branch

### 4. Verify Deployment

After deployment, Vercel will:
1. ✅ Install dependencies
2. ✅ Generate Prisma Client (`prisma generate`)
3. ✅ Apply database migrations (`prisma migrate deploy`)
4. ✅ Build TypeScript code (`tsc`)

Check the deployment logs to ensure all steps completed successfully.

### 5. Seed Your Production Database (One-Time)

**IMPORTANT:** Database seeding is NOT automatic. You must do this manually after first deployment.

**Option A: Using Vercel CLI with environment variables**
```bash
# Set your production database URL
export DATABASE_URL="your-production-postgres-url"

# Run seed from your local machine
cd backend
npm run db:seed
```

**Option B: Create a one-time seed endpoint (more secure)**
```bash
# After deployment, call your seed endpoint with authentication
curl -X POST https://your-app.vercel.app/api/setup/seed \
  -H "Authorization: Bearer YOUR_SECRET_TOKEN"
```

---

## 🔄 Future Schema Changes

When you need to modify your database schema:

### 1. Create a Migration Locally

```bash
cd backend

# Edit your schema.prisma file
# Then create a migration
npx prisma migrate dev --name describe_your_changes

# Example:
npx prisma migrate dev --name add_user_preferences
```

This will:
- Generate a new migration file in `prisma/migrations/`
- Apply the migration to your local database
- Update Prisma Client

### 2. Test Locally

```bash
# Ensure your app works with the new schema
npm run dev

# Run any tests
npm test
```

### 3. Commit and Deploy

```bash
# Commit the new migration files
git add backend/prisma/migrations/
git commit -m "Add migration: describe_your_changes"
git push

# Vercel will automatically apply the migration during deployment
```

---

## 📊 Database Management

### View Your Database

```bash
# Open Prisma Studio to view/edit data
cd backend
npx prisma studio
```

### Reset Database (Development Only!)

```bash
# ⚠️ WARNING: This will delete all data!
cd backend
npx prisma migrate reset
```

### Check Migration Status

```bash
cd backend
npx prisma migrate status
```

---

## 🐛 Troubleshooting

### Migration Fails During Deployment

**Problem:** `Error: P3009: migrate found failed migration`

**Solution:**
```bash
# Mark the failed migration as rolled back
npx prisma migrate resolve --rolled-back MIGRATION_NAME

# Create a new migration to fix the issue
npx prisma migrate dev --name fix_previous_migration
```

### Database Connection Issues

**Problem:** `Error: P1001: Can't reach database server`

**Check:**
1. DATABASE_URL is correctly set in Vercel environment variables
2. Database is publicly accessible (check IP whitelist)
3. Connection string includes `?schema=public` for PostgreSQL

### Build Fails on Vercel

**Problem:** TypeScript compilation errors

**Solution:**
```bash
# Test build locally first
cd backend
npm run build

# Fix any TypeScript errors
# Then commit and deploy
```

---

## 📝 Default Credentials (After Seeding)

**Admin:**
- Email: `admin@hiast.edu.sy`
- Password: `admin123`

**Correspondence Officer:**
- Email: `fatima.sakr@hiast.edu.sy`
- Password: `password123`

**Department Heads:**
- IT: `ahmad.rashid@hiast.edu.sy` / `password123`
- HR: `layla.hassan@hiast.edu.sy` / `password123`
- Finance: `omar.khalil@hiast.edu.sy` / `password123`

⚠️ **IMPORTANT:** Change these passwords immediately in production!

---

## 🔐 Security Recommendations

1. **Change default passwords** after seeding
2. **Set strong JWT secrets** (use a password generator)
3. **Enable CORS** only for your frontend domain
4. **Use HTTPS** for all API calls
5. **Enable rate limiting** for authentication endpoints
6. **Regular backups** of your production database
7. **Monitor logs** for suspicious activity

---

## 📚 Additional Resources

- [Prisma Migrate Documentation](https://www.prisma.io/docs/concepts/components/prisma-migrate)
- [Vercel Deployment Documentation](https://vercel.com/docs)
- [Prisma Best Practices](https://www.prisma.io/docs/guides/performance-and-optimization)

---

**Need Help?** Check the troubleshooting section or review the Vercel deployment logs.
