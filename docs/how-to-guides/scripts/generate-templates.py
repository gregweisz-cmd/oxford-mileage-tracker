#!/usr/bin/env python3
"""
Generate comprehensive HTML templates for all PDF guides
"""

import os
from pathlib import Path

# Get the templates directory
templates_dir = Path(__file__).parent.parent / 'templates'

# Common CSS (same as mobile-app-template.html)
common_css = """        @page {
            size: letter;
            margin: 0.75in;
            @top-center {
                content: "{{TITLE}}";
                font-size: 10pt;
                color: #666;
            }
            @bottom-center {
                content: "Page " counter(page) " of " counter(pages);
                font-size: 10pt;
                color: #666;
            }
        }
        
        body {
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            line-height: 1.6;
            color: #333;
            max-width: 8.5in;
            margin: 0 auto;
            padding: 0;
        }
        
        .cover-page {
            page-break-after: always;
            display: flex;
            flex-direction: column;
            justify-content: center;
            align-items: center;
            min-height: 9in;
            text-align: center;
        }
        
        .cover-page h1 {
            font-size: 36pt;
            margin-bottom: 20pt;
            color: #1976d2;
        }
        
        .cover-page .subtitle {
            font-size: 18pt;
            color: #666;
            margin-bottom: 40pt;
        }
        
        .cover-page .version {
            font-size: 12pt;
            color: #999;
            margin-top: 40pt;
        }
        
        h1 {
            font-size: 24pt;
            color: #1976d2;
            margin-top: 30pt;
            margin-bottom: 15pt;
            page-break-after: avoid;
        }
        
        h2 {
            font-size: 18pt;
            color: #1976d2;
            margin-top: 25pt;
            margin-bottom: 12pt;
            page-break-after: avoid;
        }
        
        h3 {
            font-size: 14pt;
            color: #333;
            margin-top: 20pt;
            margin-bottom: 10pt;
            page-break-after: avoid;
        }
        
        h4 {
            font-size: 12pt;
            color: #555;
            margin-top: 15pt;
            margin-bottom: 8pt;
            font-weight: bold;
        }
        
        p {
            margin-bottom: 10pt;
            text-align: justify;
        }
        
        ul, ol {
            margin-bottom: 10pt;
            padding-left: 25pt;
        }
        
        li {
            margin-bottom: 5pt;
        }
        
        .quick-start {
            background-color: #e3f2fd;
            border-left: 4px solid #1976d2;
            padding: 15pt;
            margin: 20pt 0;
            page-break-inside: avoid;
        }
        
        .quick-start h3 {
            margin-top: 0;
            color: #1976d2;
        }
        
        .tip-box {
            background-color: #fff3cd;
            border-left: 4px solid #ffc107;
            padding: 15pt;
            margin: 20pt 0;
            page-break-inside: avoid;
        }
        
        .tip-box h4 {
            margin-top: 0;
            color: #856404;
        }
        
        .warning-box {
            background-color: #f8d7da;
            border-left: 4px solid #dc3545;
            padding: 15pt;
            margin: 20pt 0;
            page-break-inside: avoid;
        }
        
        .warning-box h4 {
            margin-top: 0;
            color: #721c24;
        }
        
        .screenshot-placeholder {
            border: 2px dashed #ccc;
            background-color: #f5f5f5;
            padding: 40pt;
            text-align: center;
            margin: 20pt 0;
            page-break-inside: avoid;
        }
        
        .screenshot-placeholder::before {
            content: "[SCREENSHOT: " attr(data-screenshot-name) "]";
            color: #999;
            font-style: italic;
        }
        
        .step-number {
            display: inline-block;
            background-color: #1976d2;
            color: white;
            width: 24pt;
            height: 24pt;
            border-radius: 50%;
            text-align: center;
            line-height: 24pt;
            font-weight: bold;
            margin-right: 10pt;
            vertical-align: middle;
        }
        
        .step {
            margin-bottom: 15pt;
            page-break-inside: avoid;
        }
        
        table {
            width: 100%;
            border-collapse: collapse;
            margin: 20pt 0;
            page-break-inside: avoid;
        }
        
        th, td {
            border: 1px solid #ddd;
            padding: 8pt;
            text-align: left;
        }
        
        th {
            background-color: #1976d2;
            color: white;
            font-weight: bold;
        }
        
        tr:nth-child(even) {
            background-color: #f9f9f9;
        }
        
        .toc {
            page-break-after: always;
        }
        
        .toc h2 {
            margin-top: 0;
        }
        
        .toc ul {
            list-style: none;
            padding-left: 0;
        }
        
        .toc li {
            margin-bottom: 8pt;
        }
        
        .toc a {
            color: #1976d2;
            text-decoration: none;
        }
        
        code {
            background-color: #f4f4f4;
            padding: 2pt 6pt;
            border-radius: 3pt;
            font-family: 'Courier New', monospace;
            font-size: 10pt;
        }
        
        .feature-list {
            columns: 2;
            column-gap: 20pt;
            margin: 15pt 0;
        }
        
        .feature-list li {
            break-inside: avoid;
            margin-bottom: 8pt;
        }
        
        .section-divider {
            border-top: 2px solid #1976d2;
            margin: 30pt 0;
            page-break-before: always;
        }"""

def create_template(title, content_sections):
    """Create a complete HTML template"""
    toc_items = []
    content_html = ""
    
    # Build TOC and content
    for section in content_sections:
        section_id = section['id']
        section_title = section['title']
        section_content = section['content']
        
        toc_items.append(f'            <li><a href="#{section_id}">{section_title}</a></li>')
        content_html += f'\n    <div id="{section_id}">\n        {section_content}\n    </div>\n'
    
    toc_html = '\n'.join(toc_items)
    
    return f"""<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>{title} - Oxford House Expense Tracker</title>
    <style>{common_css}</style>
</head>
<body>
    <!-- Cover Page -->
    <div class="cover-page">
        <h1>{title}</h1>
        <div class="subtitle">Oxford House Expense Tracker</div>
        <div class="version">Version 1.0 | January 2026</div>
    </div>
    
    <!-- Table of Contents -->
    <div class="toc">
        <h2>Table of Contents</h2>
        <ul>
{toc_html}
        </ul>
    </div>
    
    {content_html}
    
    <!-- Footer Note -->
    <div style="margin-top: 40pt; padding-top: 20pt; border-top: 1px solid #ddd; font-size: 9pt; color: #666; text-align: center;">
        <p>This document is part of the Oxford House Expense Tracker documentation suite.</p>
        <p>For technical support, please contact your system administrator.</p>
        <p>Document Version: 1.0 | Last Updated: January 2026</p>
    </div>
</body>
</html>"""

print("Template generator script created. Individual templates will be created with full content.")
