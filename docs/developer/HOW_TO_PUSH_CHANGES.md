# How to Push Your Changes (Manual Steps)

Use this when you want to push commits to the remote (e.g. GitHub) yourself, without asking the assistant.

---

## Where to run the commands

Run all git commands in a **terminal** (command line):

- **In Cursor:** Use the integrated terminal: **Terminal → New Terminal** (or `` Ctrl+` ``). The terminal opens at the bottom; make sure you're in your project folder (see below).
- **Outside Cursor:** Open **PowerShell** or **Command Prompt**, then go to your project folder with `cd`.

---

## Step 1: Open the terminal and go to the project

In the terminal, go to the project root (the folder that contains `admin-web`, `src`, `docs`, etc.):

```bash
cd c:\Users\GooseWeisz\oxford-mileage-tracker
```

(If your repo lives somewhere else, use that path instead.)

---

## Step 2: See what’s changed

```bash
git status
```

This lists modified and untracked files. Use it to decide what you want to commit.

---

## Step 3: Stage the files you want to commit

**Option A – Stage specific files:**

```bash
git add path/to/file1 path/to/file2
```

Example:

```bash
git add admin-web/src/StaffPortal.tsx admin-web/docs/COST_CENTER_PAGE_TROUBLESHOOTING.md
```

**Option B – Stage all modified files (not untracked):**

```bash
git add -u
```

**Option C – Stage everything (modified + new files):**

```bash
git add .
```

Use Option A when you only want to commit certain changes (e.g. leave out `expense_tracker.db` or other local files).

---

## Step 4: Commit

```bash
git commit -m "Short description of what you fixed or added"
```

Example:

```bash
git commit -m "Cost Center: fix save so descriptions persist after refresh"
```

---

## Step 5: Push to the remote

```bash
git push origin main
```

If your default branch has another name (e.g. `master`), use that instead of `main`. If the remote isn’t named `origin`, use the name you see in `git remote -v`.

---

## Quick reference (copy-paste)

From the project root, a typical flow:

```bash
cd c:\Users\GooseWeisz\oxford-mileage-tracker
git status
git add -u
git commit -m "Describe your change here"
git push origin main
```

After pushing, redeploy your app (e.g. Render) so the live site uses the new code.
