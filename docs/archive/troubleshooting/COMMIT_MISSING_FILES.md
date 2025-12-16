# Fix Vercel Build Error

## Problem
Vercel build is failing with:
```
Module not found: Error: Can't resolve './components/KeyboardShortcutsDialog'
```

This means `KeyboardShortcutsDialog.tsx` is being imported but the file isn't in git.

## Solution

Run these commands to commit the missing files:

```powershell
cd C:\Users\GooseWeisz\oxford-mileage-tracker

# Add the missing keyboard shortcut files
git add admin-web/src/components/KeyboardShortcutsDialog.tsx
git add admin-web/src/hooks/useKeyboardShortcuts.ts

# Also add any other untracked files that might be needed
git add admin-web/src/components/AuthCallback.tsx
git add admin-web/src/components/ErrorBoundary.tsx

# Commit
git commit -m "Add KeyboardShortcutsDialog, AuthCallback, and ErrorBoundary components"

# Push
git push origin main
```

Or use the script:

```powershell
powershell -ExecutionPolicy Bypass -File FIX_VERCEL_BUILD.ps1
```

After pushing, Vercel will automatically rebuild in 2-3 minutes.

