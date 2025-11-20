// NEW GRID TIMESHEET IMPLEMENTATION
// To replace the section from lines 5002-5202 (the old timesheet implementation)

// Keep the header
doc.addPage();
yPos = margin + 20;
doc.setFontSize(14);
doc.setFont('helvetica', 'bold');
safeText('MONTHLY TIMESHEET', pageWidth / 2, yPos, { align: 'center' });

yPos += 30;
doc.setFontSize(11);
safeText(`${reportData.name || 'N/A'} - ${reportData.month} ${reportData.year}`, pageWidth / 2, yPos, { align: 'center' });

yPos += 30;

// Helper function for grid cells
const drawGridCell = (x, y, width, height, text, color = 'white', textColor = 'black', align = 'center', fontSize = 6) => {
  setColor(color);
  doc.rect(x, y, width, height, 'FD');
  doc.setTextColor(textColor === 'white' ? 255 : 0, textColor === 'white' ? 255 : 0, textColor === 'white' ? 255 : 0);
  doc.setFontSize(fontSize);
  doc.setFont('helvetica', 'bold');
  
  if (align === 'center') {
    safeText(text, x + width/2, y + height/2 + 2, { align: 'center' });
  } else if (align === 'right') {
    safeText(text, x + width - 2, y + height/2 + 2);
  } else {
    safeText(text, x + 2, y + height/2 + 2);
  }
  
  doc.setTextColor(0, 0, 0);
};

// Convert month name to number
let month = reportData.month;
if (typeof month === 'string' && isNaN(parseInt(month))) {
  const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 
                     'July', 'August', 'September', 'October', 'November', 'December'];
  month = monthNames.indexOf(month) + 1;
} else {
  month = parseInt(month);
}
const year = parseInt(reportData.year);
const daysInMonth = Math.min(30, new Date(year, month, 0).getDate()); // Cap at 30 days

// Fetch detailed time tracking data
const detailedTimeTrackingQuery = `
  SELECT date, costCenter, category, hours
  FROM time_tracking 
  WHERE employeeId = ? 
  AND strftime("%m", date) = ? 
  AND strftime("%Y", date) = ?
`;

const monthStr = month.toString().padStart(2, '0');
const yearStr = year.toString();

db.all(detailedTimeTrackingQuery, [reportData.employeeId, monthStr, yearStr], (err, timeEntries) => {
  if (err) {
    console.error('❌ Error fetching detailed time tracking data:', err);
    timeEntries = [];
  }
  
  // Build aggregation maps
  const costCenterDailyMap = {};
  const categoryDailyMap = { 'G&A': {}, 'HOLIDAY': {}, 'PTO': {}, 'STD/LTD': {}, 'PFL/PFML': {} };
  
  const uniqueCostCenters = new Set();
  
  timeEntries.forEach(entry => {
    const day = parseInt(entry.date.split('/')[1]);
    
    if (entry.costCenter && entry.costCenter.trim() !== '') {
      uniqueCostCenters.add(entry.costCenter);
      if (!costCenterDailyMap[entry.costCenter]) {
        costCenterDailyMap[entry.costCenter] = {};
      }
      costCenterDailyMap[entry.costCenter][day] = (costCenterDailyMap[entry.costCenter][day] || 0) + (parseFloat(entry.hours) || 0);
    }
  });
  
  let gridYPos = yPos;
  
  // ============ COST CENTER GRID SECTION ============
  doc.setFontSize(8);
  doc.setTextColor(255, 0, 0); // Red text
  safeText('* Selected cost center(s) should appear below. *', pageWidth / 2, gridYPos, { align: 'center' });
  doc.setTextColor(0, 0, 0);
  gridYPos += 12;
  
  // Grid dimensions
  const nameColWidth = 80;
  const dayColWidth = 14;
  const totalColWidth = 70;
  const cellHeight = 12;
  const totalGridWidth = nameColWidth + (30 * dayColWidth) + totalColWidth;
  const gridStartX = (pageWidth - totalGridWidth) / 2;
  
  // Header row - Days 1-30
  let headerXPos = gridStartX;
  const dayHeaderRow = [''];
  for (let day = 1; day <= 30; day++) {
    dayHeaderRow.push(day.toString());
  }
  dayHeaderRow.push('COST CENTER TOTAL');
  
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(6);
  headerXPos = gridStartX;
  dayHeaderRow.forEach((header, i) => {
    if (i === 0) {
      drawGridCell(headerXPos, gridYPos, nameColWidth, cellHeight, '', 'white', 'black', 'center');
    } else if (i <= 30) {
      drawGridCell(headerXPos, gridYPos, dayColWidth, cellHeight, header, 'white', 'black', 'center', 5);
    } else {
      doc.setTextColor(255, 0, 0);
      drawGridCell(headerXPos, gridYPos, totalColWidth, cellHeight, header, 'white', 'red', 'center', 5);
      doc.setTextColor(0, 0, 0);
    }
    headerXPos += i === 0 ? nameColWidth : (i <= 30 ? dayColWidth : totalColWidth);
  });
  gridYPos += cellHeight;
  
  const sortedCostCenters = Array.from(uniqueCostCenters).sort();
  
  // Cost center rows
  sortedCostCenters.forEach(costCenter => {
    let ccXPos = gridStartX;
    const rowData = [costCenter];
    let totalHours = 0;
    
    for (let day = 1; day <= 30; day++) {
      const hours = costCenterDailyMap[costCenter][day] || 0;
      totalHours += hours;
      rowData.push(hours > 0 ? hours.toString() : '');
    }
    
    rowData.push(`${totalHours} ${costCenter}`);
    
    rowData.forEach((data, i) => {
      const align = i === 0 ? 'left' : 'center';
      const color = i === rowData.length - 1 ? 'white' : 'white';
      const textColor = i === rowData.length - 1 ? 'red' : 'black';
      drawGridCell(ccXPos, gridYPos, i === 0 ? nameColWidth : (i <= 30 ? dayColWidth : totalColWidth), cellHeight, data, color, textColor, align);
      ccXPos += i === 0 ? nameColWidth : (i <= 30 ? dayColWidth : totalColWidth);
    });
    
    gridYPos += cellHeight;
  });
  
  // BILLABLE HOURS row
  let billXPos = gridStartX;
  const billRow = ['BILLABLE HOURS'];
  let billTotal = 0;
  
  for (let day = 1; day <= 30; day++) {
    let dayTotal = 0;
    sortedCostCenters.forEach(cc => {
      dayTotal += costCenterDailyMap[cc][day] || 0;
    });
    billTotal += dayTotal;
    billRow.push(dayTotal > 0 ? dayTotal.toString() : '');
  }
  billRow.push(`192 BILLABLE HOURS`); // TODO: Use actual total from data
  
  doc.setFont('helvetica', 'bold');
  billRow.forEach((data, i) => {
    const width = i === 0 ? nameColWidth : (i <= 30 ? dayColWidth : totalColWidth);
    drawGridCell(billXPos, gridYPos, width, cellHeight, data, 'white', 'black', 'center');
    billXPos += width;
  });
  gridYPos += cellHeight + 10;
  
  // ============ CATEGORY SECTION ============
  doc.setFontSize(8);
  doc.setTextColor(255, 0, 0);
  safeText('* If and when applicable, manually enter hours corresponding w/ the categories shown below. *', pageWidth / 2, gridYPos, { align: 'center' });
  doc.setTextColor(0, 0, 0);
  gridYPos += 12;
  
  // Re-draw header
  headerXPos = gridStartX;
  dayHeaderRow.forEach((header, i) => {
    if (i === 0) {
      drawGridCell(headerXPos, gridYPos, nameColWidth, cellHeight, '', 'white', 'black', 'center');
    } else if (i <= 30) {
      drawGridCell(headerXPos, gridYPos, dayColWidth, cellHeight, header, 'white', 'black', 'center', 5);
    } else {
      doc.setTextColor(255, 0, 0);
      drawGridCell(headerXPos, gridYPos, totalColWidth, cellHeight, header, 'white', 'red', 'center', 5);
      doc.setTextColor(0, 0, 0);
    }
    headerXPos += i === 0 ? nameColWidth : (i <= 30 ? dayColWidth : totalColWidth);
  });
  gridYPos += cellHeight;
  
  // Category rows (G&A, HOLIDAY, PTO, etc.)
  const categories = ['G&A', 'HOLIDAY', 'PTO', 'STD/LTD', 'PFL/PFML'];
  categories.forEach(cat => {
    let catXPos = gridStartX;
    const catRow = [cat];
    
    for (let day = 1; day <= 30; day++) {
      catRow.push('');
    }
    catRow.push(`0 ${cat}`);
    
    doc.setFont('helvetica', 'normal');
    catRow.forEach((data, i) => {
      const width = i === 0 ? nameColWidth : (i <= 30 ? dayColWidth : totalColWidth);
      const textColor = i === catRow.length - 1 ? 'red' : 'black';
      drawGridCell(catXPos, gridYPos, width, cellHeight, data, 'white', textColor, 'center');
      catXPos += width;
    });
    
    gridYPos += cellHeight;
  });
  
  // DAILY TOTALS row
  let dailyXPos = gridStartX;
  const dailyRow = ['DAILY TOTALS'];
  
  for (let day = 1; day <= 30; day++) {
    let dayTotal = 0;
    sortedCostCenters.forEach(cc => {
      dayTotal += costCenterDailyMap[cc][day] || 0;
    });
    dailyRow.push(dayTotal > 0 ? dayTotal.toString() : '');
  }
  dailyRow.push('192 GRAND TOTAL'); // TODO: Use actual grand total from data
  
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(255, 0, 0);
  dailyRow.forEach((data, i) => {
    const width = i === 0 ? nameColWidth : (i <= 30 ? dayColWidth : totalColWidth);
    drawGridCell(dailyXPos, gridYPos, width, cellHeight, data, 'white', 'red', 'center');
    dailyXPos += width;
  });
  doc.setTextColor(0, 0, 0);
  
  yPos = gridYPos + cellHeight + 30;
  
  // Close the database callback
});

