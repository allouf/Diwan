#!/usr/bin/env python3
"""
Fix TypeScript build errors in backend files
"""

import re
from pathlib import Path

def fix_status_controller():
    """Fix statusController.ts"""
    file_path = Path("backend/src/controllers/statusController.ts")
    content = file_path.read_text(encoding='utf-8')

    # Fix ActivityLog timestamp fields (createdAt -> timestamp)
    content = re.sub(
        r"orderBy: \{ createdAt: 'desc' \}",
        "orderBy: { timestamp: 'desc' }",
        content
    )
    content = re.sub(
        r"createdAt: true,\s*user:",
        "timestamp: true,\n        user:",
        content
    )

    # Fix Notification userId -> recipientUserId
    content = re.sub(
        r"userId: (validatedData\.assignToId|document\.createdById|doc\.createdById)",
        r"recipientUserId: \1",
        content
    )

    # Fix User status -> isActive
    content = re.sub(
        r"select: \{ id: true, fullName: true, role: true, status: true \}",
        "select: { id: true, fullName: true, role: true, isActive: true }",
        content
    )
    content = re.sub(
        r"assignee\.status !== 'ACTIVE'",
        "!assignee.isActive",
        content
    )

    file_path.write_text(content, encoding='utf-8')
    print(f"Fixed {file_path}")

def fix_user_controller():
    """Fix userController.ts"""
    file_path = Path("backend/src/controllers/userController.ts")
    content = file_path.read_text(encoding='utf-8')

    # Fix imports
    content = re.sub(
        r"import \{ PrismaClient, Role, UserStatus \} from '\.\./generated/prisma';",
        "import { PrismaClient, UserRole } from '../generated/prisma';",
        content
    )

    # Fix ActivityLog timestamp fields
    content = re.sub(
        r"orderBy: \{ createdAt: 'desc' \}",
        "orderBy: { timestamp: 'desc' }",
        content
    )
    content = re.sub(
        r"createdAt: true,\s*(details|user):",
        r"timestamp: true,\n          \1:",
        content
    )

    # Fix Notification userId -> recipientUserId
    content = re.sub(
        r"userId: (newUser\.id|updatedUser\.id|existingUser\.id)",
        r"recipientUserId: \1",
        content
    )

    # Fix User status -> isActive (remove status field from creates/updates)
    content = re.sub(
        r"status: z\.nativeEnum\(UserStatus\)\.optional\(\)",
        "isActive: z.boolean().optional()",
        content
    )
    content = re.sub(
        r"status: 'ACTIVE'",
        "isActive: true",
        content
    )

    # Fix ZodError.errors -> ZodError.issues
    content = re.sub(
        r"errors: error\.errors",
        "errors: error.issues",
        content
    )

    # Remove status field from selects
    content = re.sub(
        r",\s*status: true",
        "",
        content
    )

    # Fix _count field - add it to select
    content = re.sub(
        r"(departmentId: true,\s*createdAt: true,\s*updatedAt: true,)",
        r"\1\n          _count: {\n            select: {\n              createdDocuments: true,\n              assignedDocuments: true\n            }\n          },",
        content
    )

    # Add return statements for missing cases
    content = re.sub(
        r"(\}\);\s*\}\s*catch \(error\) \{\s*console\.error\('Error fetching users:', error\);\s*res\.status\(500\)\.json\(\{ message: 'Internal server error' \}\);\s*\}\s*\};)",
        r"  } catch (error) {\n    console.error('Error fetching users:', error);\n    return res.status(500).json({ message: 'Internal server error' });\n  }\n};",
        content,
        count=1
    )

    file_path.write_text(content, encoding='utf-8')
    print(f"Fixed {file_path}")

def fix_search_controller():
    """Fix searchController.ts"""
    file_path = Path("backend/src/controllers/searchController.ts")
    content = file_path.read_text(encoding='utf-8')

    # Fix QueryMode to be literal 'insensitive'
    content = re.sub(
        r"mode: 'insensitive'",
        "mode: 'insensitive' as const",
        content
    )

    # Fix Document categories -> category field
    content = re.sub(
        r"categories: \{",
        "category: {",
        content
    )

    # Remove status field from User selects
    content = re.sub(
        r"role: true,\s*status: true,",
        "role: true,",
        content
    )
    content = re.sub(
        r"status: 'ACTIVE'",
        "isActive: true",
        content
    )

    # Fix User.department include
    content = re.sub(
        r"(\s+users: users\.map\(user => \(\{[^}]+department: user\.department\?\.name)",
        r"\1",
        content
    )

    # Remove content field from Document where clause (line 483)
    content = re.sub(
        r"\{ content: \{ contains: query, mode: 'insensitive' as const \} \},",
        "",
        content
    )

    file_path.write_text(content, encoding='utf-8')
    print(f"Fixed {file_path}")

def fix_auth_controller():
    """Fix authController.ts"""
    file_path = Path("backend/src/controllers/authController.ts")
    content = file_path.read_text(encoding='utf-8')

    # Fix return statement at line 25
    content = re.sub(
        r"return res\.status\(429\)\.json\(response\);",
        "res.status(429).json(response);\n      return;",
        content,
        count=1
    )

    file_path.write_text(content, encoding='utf-8')
    print(f"Fixed {file_path}")

def fix_upload_middleware():
    """Fix upload.ts middleware"""
    file_path = Path("backend/src/middleware/upload.ts")
    content = file_path.read_text(encoding='utf-8')

    # Add return to middleware functions that are missing it
    content = re.sub(
        r"(next\(\);\s*\};)",
        r"return next();\n};",
        content
    )

    file_path.write_text(content, encoding='utf-8')
    print(f"Fixed {file_path}")

if __name__ == "__main__":
    fix_status_controller()
    fix_user_controller()
    fix_search_controller()
    fix_auth_controller()
    fix_upload_middleware()
    print("\nAll fixes applied!")
