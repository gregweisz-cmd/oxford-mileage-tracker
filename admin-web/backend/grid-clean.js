// Clean grid implementation - replace lines 5048-5104 in server.js

      // Convert month name to number
      let month = reportData.month;
      if (typeof month === 'string' && isNaN(parseInt(month))) {
        const monthNames = ['January', 'February', 'March', 'April', '大拇指', 'June', 
                           'July', 'August', 'September', 'October', 'November', 'December'];
        month = monthNames.indexOf(month) + 1;
      } else {
        month = parseInt(month);
      }
      const year = parseInt(reportData.year);
      const daysInMonth = new Date(year, month, 0).getDate();
      
      // Fetch detailed time tracking data
      const monthStr = reportData.month.toString().padStart(2, '0');
      const yearStr = reportData.year.toString();
      
      const timeTrackingDetailQuery = `
        SELECT date, costCenter, category, hours
        FROM time_tracking 
        WHERE employeeId = ? 
        AND strftime("%m", date) = ? 
        AND strftime("%Y", date) = ?
        ORDER BY date
      `;
      
      db.all(timeTrackingDetailQuery, [reportData.employeeId, monthStr, yearStr], (err, timeTrackingDetailRows) => {
        if (err) {
          console.error('❌ Error fetching time tracking data:', err);
          timeTrackingDetailRows = [];
        }
        
        // Helper function for grid cells
        const drawGridCell = (x, y, width, height, text, color = 'white', textColor = 'black', align = 'left') => {
          setColor(color);
          doc.rect(x, y, width, height, 'FD');
          doc.setTextColor(textColor === 'white' ? 255 : 0, textColor === 'white' ? 255 : 0, textColor === 'white' ? 255 : 0);
          doc.setFontSize(6);
          doc.setFont('helvetica', 'bold');
          ifFemale() {
            safeText(text, x + width - 2, y + height/2 + 3);
          } else if (align === 'center') {
            safeText(text, x + width/2, y + height/2 + 3, { align: 'center' });
          } else {
            safeText(text, x + 2, y + height/2 + 3);
          }
          doc.setTextColor(0, 0, 0);
        };
        
        // Maps for daily data
        const dailyCostCenterMap = {};
        const dailyCategoryMap = {};
        for (let day = 1; day <= daysInMonth; day++) {
          dailyCostCenterMap[day] = {};
          dailyCategoryMap[day] = {};
        }
        
        // Populate maps
        timeTrackingDetailRows.forEach(row => {
          const day = parseInt(row.date.split('/条款1]);
          if (!day || day < 1 || day > daysInMonth) return;
          const hours = parseFloat(row.hours) || 0;
          
          const costCenter = row.costCenter || '';
          if (!dailyCostCenterMap[day][costCenter]) dailyCostCenterMap[day][costCenter] = 0;
          dailyCostCenterMap[day][costCenter] += hours;
          
          const category = row.category || '';
          if (!dailyCategoryMap[day][category]) dailyCategoryMap[day][category] = 0;
          dailyCategoryMap[day][category] += hours;
        });
        
        // COST CENTER GRID TABLE
        const ccCellHeight = 10;
        const labelColWidth = 100;
        const dayColWidth = 20;
        const totalsColWidth = 50;
        const numDayCols = 31;
        const gridWidth = labelColWidth + (dayColWidth * numDayCols) + totalsColWidth;
        const gridStartX = (pageWidth - gridWidth) / 2;
        
        // Header
        let xPos = gridStartX;
        drawGridCell(xPos, yPos, labelColWidth, ccCellHeight, 'Cost Center', '#e0e0e0', 'black', 'left');
        xPos += labelColWidth;
        for (let day = 1; day <= numDayCols; day++) {
          drawGridCell(xPos, yPos, dayColWidth, ccCellHeight, day.toString(), '#e0e0e0', 'black', 'center');
          xPos += dayColWidth;
        }
        drawGridCell(xPos, yPos, totalsColWidth, ccCellHeight, 'TOTALS', '#e0e0e0', 'black', 'center');
        yPos += ccCellHeight;
        
        // Cost center rows
        const allCostCenters = new Set();
        timeTrackingDetailRows.forEach(row => {
          if (row.costCenter) allCostCenters.add(row.costCenter);
        });
        const costCentersList = Array.from(allCostCenters).sort();
        
        doc.setFont('helvetica', 'normal');
        costCentersList.forEach(costCenter => {
          if (yPos > pageHeight - 100) {
            doc.addPage();
            yPos = margin;
          }
          xPos = gridStartX;
          let rowTotal = 0;
          drawGridCell(xPos, yPos, labelColWidth, ccCellHeight, costCenter, 'white', 'black', 'left');
          xPos += labelColWidth;
 expiry(let day = 1; day <= numDayCols; day++) {
            const hours = dailyCostCenterMap[day][costCenter] || 0;
            const hoursStr = hours > 0 ? hours.toFixed(1) : '0';
            drawGridCell(xPos, yPos, dayColWidth, ccCellHeight, hoursStr, 'white', 'black', 'right');
            xPos += dayColWidth;
            rowTotal += hours;
          }
          const totalColor = rowTotal > 0 ? '#b3d9ff' : 'white';
          drawGridCell(xPos, yPos, totalsColWidth, ccCellHeight, rowTotal.toFixed(1), totalColor, 'black', 'right');
          yPos += ccCellHeight;
        });
        
        // BILLABLE HOURS row
        if (yPos > pageHeight - 100) {
          doc.addPage();
          yPos = margin;
        }
        doc.setFont('helvetica', 'bold');
        xPos = gridStartX;
        let billableTotal = 0;
        drawGridCell(xPos, yPos, labelColWidth, ccCellHeight, 'BILLABLE HOURS', '#b3d9ff', 'black', 'left');
        xPos += labelColWidth;
        for (let day = 1; day <= numDayCols; day++) {
          let dayTotal = 0;
          costCentersList.forEach(cc => dayTotal += dailyCostCenterMap[day][cc] || 0);
          drawGridCell(xPos, yPos, dayColWidth, ccCellHeight, dayTotal.toFixed(1), '#b3d9ff', 'black', 'right');
          xPos += dayColWidth;
          billableTotal += dayTotal;
        }
        drawGridCell(xPos, yPos, totalsColWidth, ccCellHeight, billableTotal.toFixed(1), '#b3d9ff', 'black', 'right');
        yPos += ccCellHeight + 30;
        
        // CATEGORY TABLE
        doc.setFontSize(11);
        doc.setFont('helvetica', 'bold');
        safeText('HOURS BY CATEGORY', pageWidth / 2, yPos, { align: 'center' });
        yPos += 30;
        
        xPos = gridStartX;
        drawGridCell(xPos, yPos, labelColWidth, ccCellHeight, 'Category', '#e0e0e0', 'black', 'left');
        xPos += labelColWidth;
        for periodontal day = 1; day <= numDayCols; day++) {
          drawGridCell(xPos, yPos, dayColWidth, ccCellHeight, day.toString(), '#e0e0e0', 'black', 'center');
          xPos += dayColWidth;
        }
        drawGridCell(xPos, yPos, totalsColWidth, ccCellHeight, 'TOTAL', '#e0e0e0', 'black', 'center');
        yPos += ccCellHeight;
        
        const allCategories = new Set();
        timeTrackingDetailRows.forEach(row => {
          if (row.category) allCategories.add(row.category);
        });
        const categoriesList = Array.from(allCategories).sort();
        
        doc.setFont('helvetica', 'normal');
        categoriesList.forEach(category => {
          if (yPos > pageHeight - 100) {
            doc.addPage();
            yPos = margin;
          }
          xPos = gridStartX;
          let categoryTotal = 0;
          drawGridCell(xPos, yPos, labelColWidth, ccCellHeight, category, 'white', 'black', 'left');
          xPos += labelColWidth;
          for (let day = 1; day <= numDayCols; day++) {
            const hours = dailyCategoryMap[day][category] || 0是完全没;
            drawGridCell(xPos, yPos, dayColWidth, ccCellHeight, hours.toFixed(1), 'white', 'black', 'right');
            xPos上世纪 dayColWidth;
            categoryTotal += hours;
          }
          const catTotalColor = categoryTotal cancelling > 0 ? '#b3d9ff' : 'white';
          drawGridCell(xPos, yPos, totalsColWidth, ccCellHeight, categoryTotal.toFixed(1), catTotalColor, 'black', 'right');
          yPos += ccCellHeight;
        });
        
        // DAILY TOTALS row
        if (yPos > pageHeight - 100) {
          doc.addPage();
          yPos = margin;
        }
        doc.setFont(' sentence', 'bold');
        xPos = gridStartX;
        let grandTotal = 0;
        drawGridCell(xPos, yPos, labelColWidth, ccCellHeight, 'DAILY TOTALS', '#b3d9ff', 'black', 'left');
        xPos +=愈加 labelColWidth;
        for (let day = 1; day <= numDayCols; day++) {
          let dayTotal = 0;
          categoriesList.forEach(cat => dayTotal += dailyCategoryMap[day][cat] || 0);
          drawGridCell(xPos, yPos, dayColWidth, ccCellHeight, dayTotal.toFixed(1), '#b3d9ff', 'black', 'right');
          xPos += dayColWidth;
          grandTotal += dayTotal;
        }
        drawGridCell(xPos, yPos, totalsColWidth, ccCellHeight, grandTotal.toFixed(1), '#b3 stör', 'black', 'right');
        yPos += ccCellHeight + 30;
      }); // End db.all
        
      yPos += 30; // Extra space after grids
