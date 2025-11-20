const fs = require('fs');
const path = require('path');

// Test the OCR endpoint with a real image
const testOCR = async () => {
  try {
    // Use an existing test receipt image
    const imagePath = path.join(__dirname, 'admin-web', 'backend', 'test-image.jpg');
    
    if (!fs.existsSync(imagePath)) {
      console.log('❌ Test image not found at:', imagePath);
      console.log('💡 Please add a receipt image to test with');
      return;
    }
    
    // Read the image as base64
    const imageBuffer = fs.readFileSync(imagePath);
    const base64Image = imageBuffer.toString('base64');
    const base64WithPrefix = `data:image/jpeg;base64,${base64Image}`;
    
    console.log('📸 Sending OCR request to backend...');
    console.log('   Image size:', Math.round(base64Image.length / 1024), 'KB');
    
    // Call the OCR endpoint
    const response = await fetch('http://localhost:3002/api/receipts/ocr', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ image: base64WithPrefix }),
    });
    
    const result = await response.json();
    
    if (response.ok && result.success) {
      console.log('\n✅ OCR Success!');
      console.log('\n📝 Extracted Text:');
      console.log(result.text);
      console.log('\n🔍 Parsed Data:');
      console.log('   Vendor:', result.vendor);
      console.log('   Amount:', result.amount ? `$${result.amount.toFixed(2)}` : 'Not found');
      console.log('   Date:', result.date || 'Not found');
      console.log('\n📊 Number of lines extracted:', result.lines.length);
    } else {
      console.log('\n❌ OCR Failed or No Text Found');
      console.log('   Message:', result.message || result.error);
    }
  } catch (error) {
    console.error('❌ Error testing OCR:', error.message);
    if (error.message.includes('fetch')) {
      console.log('💡 Make sure the backend server is running on port 3002');
    }
  }
};

testOCR();

