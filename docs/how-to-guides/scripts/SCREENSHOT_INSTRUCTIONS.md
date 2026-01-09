# Screenshot Instructions for PDF Guides

This document provides instructions for capturing and adding screenshots to the PDF How-To guides.

## Screenshot Locations

Screenshots should be saved in the following directories:
- `images/screenshots/mobile-app/` - Mobile app screenshots
- `images/screenshots/web-portal/` - Web portal screenshots

## Naming Convention

Use descriptive, lowercase names with hyphens:
- `login-screen.png`
- `home-dashboard-full.png`
- `gps-tracking-screen.png`
- `staff-portal-mileage-tab.png`
- `supervisor-portal-approvals.png`

## Screenshot Requirements

### Mobile App Screenshots
- **Resolution**: Minimum 1080x1920 (portrait) or 1920x1080 (landscape)
- **Format**: PNG with transparency if needed, or JPG
- **Device**: Use actual device screenshots or high-quality emulator screenshots
- **Content**: Show actual app interface, not mockups

### Web Portal Screenshots
- **Resolution**: Minimum 1920x1080
- **Format**: PNG preferred
- **Browser**: Use Chrome or Firefox
- **Content**: Show actual portal interface with sample data

## Screenshot Checklist

### Mobile App
- [ ] Login screen
- [ ] Home screen/dashboard
- [ ] GPS tracking screen
- [ ] Manual entry screen
- [ ] Receipt capture screen
- [ ] Hours tracking screen
- [ ] Daily description screen
- [ ] Monthly report view
- [ ] Settings screen

### Staff Portal
- [ ] Login screen
- [ ] Portal dashboard/overview
- [ ] Daily Travel tab
- [ ] Receipts tab
- [ ] Hours Worked tab
- [ ] Daily Descriptions tab
- [ ] Monthly Summary tab
- [ ] Report submission dialog
- [ ] Notification panel

### Supervisor Portal
- [ ] Portal overview
- [ ] Approvals tab
- [ ] Reports tab with filters
- [ ] Team tab
- [ ] Analytics tab
- [ ] Report approval dialog
- [ ] Revision request dialog

### Finance Portal
- [ ] Portal overview
- [ ] Report builder
- [ ] Report list with filters
- [ ] PDF export dialog
- [ ] Excel export
- [ ] Analytics dashboard
- [ ] Per diem rules management

### Admin Portal
- [ ] Portal overview
- [ ] Employee Management tab
- [ ] Supervisor Management tab
- [ ] Cost Center Management tab
- [ ] Reports & Analytics tab
- [ ] System Settings tab

### Contracts Portal
- [ ] Portal overview
- [ ] Report filtering
- [ ] Report review interface
- [ ] Export options

## Adding Screenshots to Templates

1. Capture the screenshot
2. Save it with the appropriate name in the correct directory
3. Update the HTML template to replace the placeholder:

```html
<!-- Before -->
<div class="screenshot-placeholder" data-screenshot-name="login-screen"></div>

<!-- After -->
<img src="../images/screenshots/web-portal/login-screen.png" alt="Login Screen" style="width: 100%; max-width: 600px; margin: 20pt auto; display: block; border: 1px solid #ddd;" />
```

## Tips

- Use consistent browser zoom level (100%)
- Hide sensitive data or use sample/test data
- Ensure text is readable in screenshots
- Use consistent window sizes
- Capture full screen or relevant sections
- Add annotations if needed (arrows, highlights)
- Keep file sizes reasonable (< 500KB per image)

## Tools

Recommended tools for screenshot capture and editing:
- **Windows**: Snipping Tool, ShareX, Greenshot
- **Mac**: Screenshot utility, Skitch
- **Editing**: GIMP, Photoshop, or online editors
- **Annotations**: Annotate screenshots with arrows or highlights if needed
