/**
 * PDF Generation Script
 * Converts HTML templates to PDF files using puppeteer
 * 
 * Usage: node generate-pdfs.js
 */

const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');

const templatesDir = path.join(__dirname, '../templates');
const outputDir = path.join(__dirname, '..');

// List of templates to generate
const templates = [
    { 
        template: 'mobile-app-template.html', 
        output: 'Mobile-App-How-To.pdf',
        title: 'Mobile App How-To Guide'
    },
    { 
        template: 'staff-portal-template.html', 
        output: 'Staff-Portal-How-To.pdf',
        title: 'Staff Portal How-To Guide'
    },
    { 
        template: 'supervisor-portal-template.html', 
        output: 'Supervisor-Portal-How-To.pdf',
        title: 'Supervisor Portal How-To Guide'
    },
    { 
        template: 'finance-portal-template.html', 
        output: 'Finance-Portal-How-To.pdf',
        title: 'Finance Portal How-To Guide'
    },
    { 
        template: 'admin-portal-template.html', 
        output: 'Admin-Portal-How-To.pdf',
        title: 'Admin Portal How-To Guide'
    },
    { 
        template: 'contracts-portal-template.html', 
        output: 'Contracts-Portal-How-To.pdf',
        title: 'Contracts Portal How-To Guide'
    }
];

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
