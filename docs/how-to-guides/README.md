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

1. Edit the HTML template files in `templates/`
2. Regenerate PDFs using the script
3. Review the generated PDFs
4. Distribute updated PDFs to users

## Version

Current version: 1.0
Last updated: January 2026
