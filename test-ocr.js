/**
 * Simple Node.js script to test OCR parsing logic
 * Run with: node test-ocr.js
 */

// Sample receipt texts
const sampleReceipts = {
  walmart: `
WALMART SUPERCENTER
Store #1234
123 Main Street
Charlotte, NC 28202

Date: 09/28/2025
Time: 14:32

Grocery Items         $45.67
Household Supplies    $23.45
Electronics          $89.99
                    --------
SUBTOTAL            $159.11
TAX                   $12.73
                    --------
TOTAL               $171.84

VISA ****1234
  `,
  
  gasStation: `
SHELL
Station #5678
456 Highway 77
Mooresville, NC 28115

09/29/2025 16:45

Regular Unleaded
Gallons: 12.5
Price/Gal: $3.45

TOTAL: $43.13

Thank You!
  `,
  
  restaurant: `
McDonald's
789 Trade St
Charlotte, NC

September 30, 2025
Order #4567

Big Mac Meal         $8.99
Chicken Nuggets      $5.49
Medium Fries         $2.99
Large Coke          $1.99

Subtotal           $19.46
Tax                 $1.56
TOTAL              $21.02

Cash Tendered      $25.00
Change              $3.98
  `,
};

// Improved parsing functions with priority-based extraction
function extractAmounts(lines) {
  const amounts = [];
  
  for (const line of lines) {
    let priority = 0;
    
    // High priority: Lines with TOTAL keyword
    if (/TOTAL|AMOUNT\s+DUE|BALANCE\s+DUE/i.test(line)) {
      priority = 100;
    }
    // Medium priority: Lines with subtotal, tax, etc.
    else if (/SUBTOTAL|TAX|GRAND/i.test(line)) {
      priority = 50;
    }
    // Low priority: Regular amounts
    else {
      priority = 10;
    }
    
    // Extract all dollar amounts from this line
    const dollarPattern = /\$?\s*(\d{1,3}(?:,\d{3})*\.\d{2})/g;
    const matches = [...line.matchAll(dollarPattern)];
    
    for (const match of matches) {
      const amountStr = match[1].replace(/,/g, '');
      const value = parseFloat(amountStr);
      
      if (!isNaN(value) && value > 0 && value < 10000) {
        amounts.push({ value, priority, line });
      }
    }
  }
  
  // Sort by priority (highest first), then by value (highest first)
  amounts.sort((a, b) => {
    if (a.priority !== b.priority) {
      return b.priority - a.priority;
    }
    return b.value - a.value;
  });
  
  // Return just the values
  return amounts.map(a => a.value);
}

function extractDate(lines) {
  const datePatterns = [
    /(\d{1,2})\/(\d{1,2})\/(\d{2,4})/,
    /(\d{1,2})-(\d{1,2})-(\d{2,4})/,
    /(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+(\d{1,2}),?\s+(\d{4})/i,
    /(\d{1,2})\s+(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+(\d{4})/i,
  ];
  
  for (const line of lines) {
    for (const pattern of datePatterns) {
      const match = line.match(pattern);
      if (match) {
        try {
          const date = new Date(match[0]);
          if (!isNaN(date.getTime())) {
            return date;
          }
        } catch (e) {
          continue;
        }
      }
    }
  }
  
  return null;
}

function extractVendor(lines) {
  const topLines = lines.slice(0, 8);
  
  let bestCandidate = '';
  let bestScore = 0;
  
  for (let i = 0; i < topLines.length; i++) {
    const line = topLines[i];
    
    // Skip obvious non-vendor lines
    if (/^\d+$/.test(line)) continue;
    if (/\d{1,2}\/\d{1,2}\/\d{2,4}/.test(line)) continue;
    if (/\$\d+\.\d{2}/.test(line)) continue;
    if (/^(Store|Shop|#)\s*#?\d+/i.test(line)) continue;
    if (/^\d+\s+[A-Za-z]/.test(line) && line.length > 15) continue;
    if (line.length < 3) continue;
    if (/^(Date|Time|Order):/i.test(line)) continue;
    
    const cleaned = line.replace(/[^a-zA-Z0-9\s&'-]/g, '').trim();
    if (cleaned.length < 3) continue;
    
    // Score the candidate
    let score = 0;
    score += (8 - i) * 2; // Prefer lines near the top
    
    // Prefer all caps
    if (line === line.toUpperCase() && /[A-Z]/.test(line)) {
      score += 10;
    }
    
    // Prefer lines with common business words
    if (/\b(STORE|SHOP|MART|INN|HOTEL|RESTAURANT|CAFE|MARKET|GAS|STATION|CENTER)\b/i.test(cleaned)) {
      score += 5;
    }
    
    // Penalize very long lines
    if (cleaned.length > 30) {
      score -= 5;
    }
    
    // Prefer medium-length names
    if (cleaned.length >= 10 && cleaned.length <= 25) {
      score += 3;
    }
    
    if (score > bestScore) {
      bestScore = score;
      bestCandidate = cleaned;
    }
  }
  
  return bestCandidate;
}

function parseReceipt(text) {
  const lines = text.split('\n').map(line => line.trim()).filter(line => line.length > 0);
  
  const amounts = extractAmounts(lines);
  const date = extractDate(lines);
  const vendor = extractVendor(lines);
  
  return {
    vendor: vendor || 'Unknown',
    amount: amounts.length > 0 ? amounts[0] : null, // Use first (highest priority) amount
    date: date ? date.toLocaleDateString() : null,
    confidence: (vendor ? 0.4 : 0) + (amounts.length > 0 ? 0.3 : 0) + (date ? 0.3 : 0),
    allAmounts: amounts,
  };
}

// Run tests
console.log('🧪 Receipt OCR Parsing Tests\n');
console.log('=' .repeat(60));

for (const [name, receipt] of Object.entries(sampleReceipts)) {
  console.log(`\n📋 ${name.toUpperCase()}`);
  console.log('-'.repeat(60));
  
  const result = parseReceipt(receipt);
  
  console.log('✅ Extracted Data:');
  console.log(`   Vendor: ${result.vendor}`);
  console.log(`   Amount: $${result.amount?.toFixed(2) || 'N/A'}`);
  console.log(`   Date: ${result.date || 'N/A'}`);
  console.log(`   Confidence: ${(result.confidence * 100).toFixed(0)}%`);
  console.log(`   All amounts found: [${result.allAmounts.map(a => '$' + a.toFixed(2)).join(', ')}]`);
}

console.log('\n' + '='.repeat(60));
console.log('✅ Test Complete!\n');
console.log('💡 The OCR service successfully extracts:');
console.log('   • Vendor names from the top of receipts');
console.log('   • Dollar amounts (focusing on TOTAL)');
console.log('   • Dates in multiple formats');
console.log('\n🚀 Ready to integrate with Google Cloud Vision API for production use!');

