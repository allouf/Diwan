#!/usr/bin/env python3
"""Fix Notification creates to match schema"""

from pathlib import Path
import re

def fix_notifications(file_path):
    """Fix notification creates in a controller file"""
    content = file_path.read_text(encoding='utf-8')

    # Pattern to match notification creates
    # Replace title, type, relatedId with proper fields
    content = re.sub(
        r'(\s+)recipientUserId: ([^,\n]+),\n\s+title: [^\n]+,\n\s+message: ([^\n]+),\n\s+type: [^\n]+,\n\s+relatedId: ([^\n]+)',
        r'\1recipientUserId: \2,\n\1message: \3,\n\1messageAr: \3, // TODO: Add Arabic translation\n\1documentId: \4,\n\1departmentId: currentUser.departmentId || ""',
        content
    )

    file_path.write_text(content, encoding='utf-8')
    print(f"Fixed {file_path}")

# Fix status and user controllers
fix_notifications(Path("backend/src/controllers/statusController.ts"))
fix_notifications(Path("backend/src/controllers/userController.ts"))
print("All notifications fixed!")
