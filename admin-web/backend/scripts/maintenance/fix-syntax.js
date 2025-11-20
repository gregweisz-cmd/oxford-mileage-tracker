const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'server.js');
let content = fs.readFileSync(filePath, 'utf8');

// Remove the problematic lines 5262-5263 (garbage text and duplicate closing brace)
const lines = content.split('\n');
const fixedLines = [];

for (let i = 0; i < lines.length; i++) {
  const lineNum = i + 1;
  // Skip lines 5262 and 5263 if they contain garbage
  if (lineNum === 5262 || lineNum === 5263) {
    const line = lines[i];
    // Only skip if it contains garbage characters or is a duplicate closing brace
    if (line.includes('โปร') || (lineNum === 5263 && line.trim() === '}')) {
      continue;
    }
  }
  fixedLines.push(lines[i]);
}

fs.writeFileSync(filePath, fixedLines.join('\n'), 'utf8');
console.log('Fixed syntax errors');
