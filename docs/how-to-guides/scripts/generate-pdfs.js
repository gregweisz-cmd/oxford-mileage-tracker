/**
 * PDF Generation Script
 * Converts HTML how-to templates to PDF files using Puppeteer.
 * Injects screenshots from images/screenshots/{mobile-app|web-portal} into
 * placeholder divs and outputs PDFs to docs/how-to-guides/.
 *
 * Usage: npm run generate  (or: node generate-pdfs.js)
 */

const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');

const templatesDir = path.join(__dirname, '../templates');
const outputDir = path.join(__dirname, '..');
const imagesDir = path.join(__dirname, '../images/screenshots');

// All template definitions (Finance & Contracts not yet generated)
const allTemplates = [
    { template: 'mobile-app-template.html', output: 'Mobile-App-How-To.pdf', title: 'Mobile App How-To Guide' },
    { template: 'staff-portal-template.html', output: 'Staff-Portal-How-To.pdf', title: 'Staff Portal How-To Guide' },
    { template: 'senior-staff-portal-template.html', output: 'Senior-Staff-Portal-How-To.pdf', title: 'Senior Staff Portal How-To Guide' },
    { template: 'supervisor-portal-template.html', output: 'Supervisor-Portal-How-To.pdf', title: 'Supervisor Portal How-To Guide' },
    { template: 'admin-portal-template.html', output: 'Admin-Portal-How-To.pdf', title: 'Admin Portal How-To Guide' },
    { template: 'finance-portal-template.html', output: 'Finance-Portal-How-To.pdf', title: 'Finance Portal How-To Guide' },
    { template: 'contracts-portal-template.html', output: 'Contracts-Portal-How-To.pdf', title: 'Contracts Portal How-To Guide' }
];

// Build first 5 guides only (Mobile, Staff, Senior Staff, Supervisor, Admin)
const templates = allTemplates.filter((_, i) => i < 5);

async function generatePDF(templateFile, outputFile, title) {
    const templatePath = path.join(templatesDir, templateFile);
    const outputPath = path.join(outputDir, outputFile);
    
    // Check if template exists
    if (!fs.existsSync(templatePath)) {
        console.warn(`⚠️  Template not found: ${templateFile} - Skipping`);
        return false;
    }
    
    try {
        console.log(`📄 Generating PDF: ${title}...`);
        
        // Read HTML template
        let html = fs.readFileSync(templatePath, 'utf8');
        
        // Replace title placeholder if present
        html = html.replace(/\{\{TITLE\}\}/g, title);
        
        // Screenshots: mobile-app template uses mobile-app folder; all others use web-portal
        const screenshotDir = templateFile.includes('mobile-app') ? 'mobile-app' : 'web-portal';
        
        // Replace screenshot placeholders with actual images (as base64 data URIs)
        const placeholderRegex = /<div class="screenshot-placeholder" data-screenshot-name="([^"]+)"><\/div>/g;
        let match;
        const replacements = [];
        
        while ((match = placeholderRegex.exec(html)) !== null) {
            const screenshotName = match[1];
            const imagePath = path.join(imagesDir, screenshotDir, `${screenshotName}.png`);
            
            if (fs.existsSync(imagePath)) {
                try {
                    // Read image and convert to base64
                    const imageBuffer = fs.readFileSync(imagePath);
                    const base64Image = imageBuffer.toString('base64');
                    const imageDataUri = `data:image/png;base64,${base64Image}`;
                    
                    // Size screenshot to fit on one page without spilling (Letter 8.5x11, 0.75in margins)
                    replacements.push({
                        placeholder: match[0],
                        replacement: `<div style="text-align: center; margin: 12pt 0; page-break-inside: avoid;"><img src="${imageDataUri}" alt="${screenshotName}" style="max-width: 6.25in; max-height: 4.5in; width: auto; height: auto; object-fit: contain; border: 1px solid #ddd; border-radius: 4pt; box-shadow: 0 2pt 4pt rgba(0,0,0,0.1);" /></div>`
                    });
                } catch (err) {
                    console.warn(`   ⚠️  Error reading screenshot ${screenshotName}.png: ${err.message}`);
                }
            } else {
                console.warn(`   ⚠️  Screenshot not found: ${screenshotName}.png (keeping placeholder)`);
            }
        }
        
        // Apply all replacements
        replacements.forEach(({ placeholder, replacement }) => {
            html = html.replace(placeholder, replacement);
        });
        
        // Launch browser
        const browser = await puppeteer.launch({
            headless: true,
            args: ['--no-sandbox', '--disable-setuid-sandbox']
        });
        
        const page = await browser.newPage();
        
        // Set content
        await page.setContent(html, {
            waitUntil: 'networkidle0'
        });
        
        // Generate PDF
        await page.pdf({
            path: outputPath,
            format: 'Letter',
            margin: {
                top: '0.75in',
                right: '0.75in',
                bottom: '0.75in',
                left: '0.75in'
            },
            printBackground: true,
            displayHeaderFooter: true,
            headerTemplate: `
                <div style="font-size: 10px; text-align: center; width: 100%; color: #666; padding-top: 10px;">
                    ${title}
                </div>
            `,
            footerTemplate: `
                <div style="font-size: 10px; text-align: center; width: 100%; color: #666; padding-bottom: 10px;">
                    Page <span class="pageNumber"></span> of <span class="totalPages"></span>
                </div>
            `
        });
        
        await browser.close();
        
        console.log(`✅ Generated: ${outputFile}`);
        return true;
    } catch (error) {
        console.error(`❌ Error generating ${outputFile}:`, error.message);
        return false;
    }
}

async function main() {
    console.log('🚀 Starting PDF generation...\n');
    
    let successCount = 0;
    let failCount = 0;
    
    for (const template of templates) {
        const success = await generatePDF(
            template.template,
            template.output,
            template.title
        );
        
        if (success) {
            successCount++;
        } else {
            failCount++;
        }
        
        // Small delay between generations
        await new Promise(resolve => setTimeout(resolve, 500));
    }
    
    console.log('\n📊 Generation Summary:');
    console.log(`   ✅ Success: ${successCount}`);
    console.log(`   ❌ Failed: ${failCount}`);
    console.log(`   📁 Output directory: ${outputDir}`);
    
    if (failCount > 0) {
        console.log('\n⚠️  Some PDFs failed to generate. Check the errors above.');
        process.exit(1);
    } else {
        console.log('\n✨ All PDFs generated successfully!');
    }
}

// Run if called directly
if (require.main === module) {
    main().catch(error => {
        console.error('Fatal error:', error);
        process.exit(1);
    });
}

module.exports = { generatePDF, main };
