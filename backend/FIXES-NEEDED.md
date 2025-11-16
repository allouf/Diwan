# Backend Fixes Needed Before Deployment

## 🚨 Critical Issues (256 errors across 20 files)

### 1. Missing Dependencies
```bash
cd backend
npm install zod
```

### 2. Prisma Schema Issues

The Prisma schema is out of sync with the TypeScript code. Need to update `prisma/schema.prisma`:

#### User Model - Add missing fields:
```prisma
model User {
  // ... existing fields
  fullName String  // Currently missing
  // ... rest
}
```

#### Document Model - Add missing fields:
```prisma
model Document {
  // ... existing fields  
  assignedToId String?  // Currently missing
  assignedTo User? @relation("AssignedDocuments", fields: [assignedToId], references: [id])
  // ... rest
}
```

#### ActivityLog Model - Add missing fields:
```prisma
model ActivityLog {
  // ... existing fields
  relatedId String?  // Currently missing
  // ... rest
}
```

#### Department Model - Add missing field:
```prisma
model Department {
  // ... existing fields
  code String @unique  // Currently missing
  // ... rest
}
```

#### Attachment Model - Add missing fields:
```prisma
model Attachment {
  // ... existing fields
  filename String  // Currently missing
  mimetype String  // Currently missing
  thumbnailPath String?  // Currently missing
  description String?  // Currently missing
  isPublic Boolean @default(false)  // Currently missing
  uploadedBy String  // Currently missing
  // ... rest
}
```

### 3. Export Missing Functions

#### `backend/src/middleware/auth.ts`:
```typescript
export { authenticateToken, requireRole };
```

#### `backend/src/middleware/activityLogger.ts`:
```typescript
export { logActivity };
```

### 4. Enum Mismatches

#### UserRole enum - Make consistent:
```typescript
// In schema.prisma
enum UserRole {
  ADMIN
  CORRESPONDENCE_OFFICER
  DEPARTMENT_HEAD
  DEPARTMENT_USER
}
```

#### DocumentStatus enum - Add missing values:
```prisma
enum DocumentStatus {
  DRAFT
  PENDING
  IN_PROGRESS  // Add this
  COMPLETED
  REJECTED  // Add this
  ARCHIVED
}
```

### 5. Type Export Issues

#### `backend/src/generated/prisma`:
Ensure Prisma generates all types:
```bash
npx prisma generate
```

### 6. Function Return Types

Many async functions missing return statements. Example pattern:
```typescript
export const someAsyncFunction = async (req: Request, res: Response) => {
  try {
    // ... logic
    return res.json({ success: true });  // ADD return
  } catch (error) {
    return res.status(500).json({ error: 'Failed' });  // ADD return
  }
};
```

## 🔧 Quick Fix Script

Run this to fix most issues:

```bash
cd backend

# 1. Install missing dependencies
npm install zod

# 2. Regenerate Prisma client
npx prisma generate

# 3. Update database schema
npx prisma db push

# 4. Run TypeScript compilation to see remaining errors
npm run build
```

## 📝 Files Needing Most Attention

1. `fileController.ts` - 69 errors
2. `userController.ts` - 47 errors  
3. `searchController.ts` - 35 errors
4. `statusController.ts` - 31 errors
5. `activityController.ts` - 23 errors

## 🎯 Recommended Approach

**Option 1: Fix Locally First (Recommended)**
1. Fix all schema issues locally
2. Test compilation: `npm run build`
3. Test locally: `npm run dev`
4. Once working, deploy to Vercel

**Option 2: Simplify for Deployment**
1. Create minimal API with just auth endpoints
2. Deploy basic version
3. Add features incrementally

## 📚 Resources

- Prisma Schema: https://www.prisma.io/docs/reference/api-reference/prisma-schema-reference
- Zod Validation: https://zod.dev/
- TypeScript Handbook: https://www.typescriptlang.org/docs/handbook/

---

**Status**: Backend cannot deploy until these issues are resolved.  
**Workaround**: Deploy frontend first, connect to mock API or fix backend locally.