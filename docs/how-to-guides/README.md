# PDF How-To Guides

This directory contains comprehensive PDF How-To guides for the Oxford House Expense Tracker system.

## Guides Available

1. **Mobile App How-To Guide** - Complete guide for using the mobile app (iOS/Android)
2. **Staff Portal How-To Guide** - Guide for employees using the web portal
3. **Supervisor Portal How-To Guide** - Guide for supervisors managing team reports
4. **Finance Portal How-To Guide** - Guide for finance team members
5. **Admin Portal How-To Guide** - Guide for system administrators
6. **Contracts Portal How-To Guide** - Guide for contracts/audit team

## Structure

- `templates/` - HTML templates for each guide
- `scripts/` - Scripts for generating PDFs
- `images/screenshots/` - Screenshot placeholders and actual screenshots
- `*.pdf` - Generated PDF files

## Generating PDFs

To generate PDFs from the HTML templates, run:

```bash
cd scripts
node generate-pdfs.js
```

This will create PDF files for all guides in the main directory.

## Screenshots

Screenshot placeholders are included in the templates. To add actual screenshots:

1. Capture screenshots of the relevant features
2. Save them in `images/screenshots/mobile-app/` or `images/screenshots/web-portal/`
3. Update the HTML templates to reference the actual image files
4. Regenerate the PDFs

## Content Updates

To update guide content:

1. Check `FEATURES_UPDATE.md` for recently added/changed/removed features.
2. Edit the HTML template files in `templates/` and `CONTENT_GUIDE.md` / `SCREENSHOT_CHECKLIST.md` / `QUICK_SCREENSHOT_GUIDE.md` as needed.
3. Capture or refresh screenshots per `SCREENSHOT_CHECKLIST.md` and `QUICK_SCREENSHOT_GUIDE.md`.
4. Regenerate PDFs using the script.
5. Review the generated PDFs and distribute updated PDFs to users.

## Version

Current version: 1.0
Last updated: January 2026
See `FEATURES_UPDATE.md` for Jan 2026 feature changes (Sync from HR API, Go to today).
