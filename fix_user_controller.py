#!/usr/bin/env python3
"""
Fix userController.ts properly
"""

from pathlib import Path

def fix_user_controller():
    file_path = Path("backend/src/controllers/userController.ts")
    lines = file_path.read_text(encoding='utf-8').splitlines()

    new_lines = []
    i = 0
    while i < len(lines):
        line = lines[i]

        # Fix imports on line 2
        if i == 1 and 'Role, UserStatus' in line:
            line = line.replace('Role, UserStatus', 'UserRole')

        # Fix schema references to Role -> UserRole (lines 13, 21)
        if 'z.nativeEnum(Role)' in line:
            line = line.replace('z.nativeEnum(Role)', 'z.nativeEnum(UserRole)')

        # Fix UserStatus -> isActive boolean (line 23)
        if 'z.nativeEnum(UserStatus)' in line:
            line = line.replace('status: z.nativeEnum(UserStatus).optional()', 'isActive: z.boolean().optional()')

        # Fix status references in where clause (line 51)
        if 'if (status) where.status = status;' in line:
            line = line.replace('if (status) where.status = status;', 'if (status) where.isActive = status === \'ACTIVE\';')

        # Fix select to remove status and add _count (lines 65-91)
        if i == 69 and 'status: true,' in line:
            new_lines.append(line.replace('status: true,', ''))
            i += 1
            continue

        # Fix duplicate _count (remove first one at lines 81-86)
        if i >= 80 and i <= 85 and '_count:' in line:
            # Skip the duplicate _count block
            depth = 0
            while i < len(lines):
                if '{' in lines[i]:
                    depth += 1
                if '}' in lines[i]:
                    depth -= 1
                    if depth == 0:
                        i += 1
                        break
                i += 1
            continue

        # Fix ActivityLog timestamp (lines 190, 196, 216, 219)
        if 'orderBy: { createdAt:' in line and 'activityLog' in lines[max(0, i-10):i+1]:
            line = line.replace("orderBy: { createdAt: 'desc' }", "orderBy: { timestamp: 'desc' }")
        if 'createdAt: true,' in line and i >= 195 and i <= 230:
            line = line.replace('createdAt: true,', 'timestamp: true,')

        # Fix Notification userId -> recipientUserId (lines 311, 409, 528)
        if 'userId: newUser.id,' in line:
            line = line.replace('userId: newUser.id,', 'recipientUserId: newUser.id,')
        if 'userId: updatedUser.id,' in line:
            line = line.replace('userId: updatedUser.id,', 'recipientUserId: updatedUser.id,')
        if 'userId: existingUser.id,' in line:
            line = line.replace('userId: existingUser.id,', 'recipientUserId: existingUser.id,')

        # Fix status field in create (line 281)
        if "status: 'ACTIVE'" in line:
            line = line.replace("status: 'ACTIVE'", "isActive: true")

        # Remove status from select (line 288, 384, 450)
        if i in [287, 383] and 'status: true,' in line:
            new_lines.append(line.replace('status: true,', ''))
            i += 1
            continue

        # Fix delete function status checks (lines 458, 466, 470)
        if i >= 456 and i <= 472:
            if 'status: true' in line:
                line = line.replace('status: true', 'isActive: true')
            if "status === 'INACTIVE'" in line:
                line = line.replace("status === 'INACTIVE'", "!isActive")
            if "status: 'INACTIVE'" in line:
                line = line.replace("status: 'INACTIVE'", "isActive: false")

        # Fix getUserStats status reference (line 559)
        if "where: { status: 'ACTIVE' }" in line:
            line = line.replace("where: { status: 'ACTIVE' }", "where: { isActive: true }")

        # Fix ZodError.errors -> ZodError.issues (lines 323, 424, 540)
        if 'errors: error.errors' in line:
            line = line.replace('errors: error.errors', 'errors: error.issues')

        # Fix validatedData.status references (line 419, 425)
        if 'validatedData.status' in line:
            line = line.replace('validatedData.status', 'validatedData.isActive')

        # Add return statements where missing
        if 'res.status(500).json({ message:' in line and 'return' not in line:
            line = '    return ' + line.lstrip()
        if 'res.status(201).json' in line and i >= 318 and i <= 327 and 'return' not in line:
            line = '    return ' + line.lstrip()
        if 'res.json({' in line and i >= 430 and i <= 433 and 'return' not in line:
            line = '    return ' + line.lstrip()
        if 'res.json({ message:' in line and i >= 488 and i <= 492 and 'return' not in line:
            line = '    return ' + line.lstrip()
        if 'res.json({ message:' in line and i >= 545 and i <= 549 and 'return' not in line:
            line = '    return ' + line.lstrip()

        new_lines.append(line)
        i += 1

    file_path.write_text('\n'.join(new_lines), encoding='utf-8')
    print(f"Fixed {file_path}")

if __name__ == "__main__":
    fix_user_controller()
    print("User controller fixed!")
