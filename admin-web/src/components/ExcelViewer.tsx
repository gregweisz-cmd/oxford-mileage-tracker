import React, { useState, useRef } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Box,
  Typography,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  IconButton,
  Chip,
  Alert,
  CircularProgress,
  Tabs,
  Tab,
} from '@mui/material';
import {
  Close as CloseIcon,
  Download as DownloadIcon,
  Upload as UploadIcon,
} from '@mui/icons-material';
import * as XLSX from 'xlsx';
import { debugError } from '../config/debug';

interface ExcelViewerProps {
  open: boolean;
  onClose: () => void;
  file?: File | null;
  data?: ArrayBuffer | null;
  fileName?: string;
}

interface SheetData {
  name: string;
  data: any[][];
  headers: string[];
}

export const ExcelViewer: React.FC<ExcelViewerProps> = ({
  open,
  onClose,
  file,
  data,
  fileName
}) => {
  const [sheets, setSheets] = useState<SheetData[]>([]);
  const [currentSheetIndex, setCurrentSheetIndex] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const processExcelFile = async (fileData: File | ArrayBuffer, name: string) => {
    setLoading(true);
    setError(null);
    
    try {
      let workbook: XLSX.WorkBook;
      
      if (fileData instanceof File) {
        const arrayBuffer = await fileData.arrayBuffer();
        workbook = XLSX.read(arrayBuffer, { type: 'array' });
      } else {
        workbook = XLSX.read(fileData, { type: 'array' });
      }

      const processedSheets: SheetData[] = [];

      workbook.SheetNames.forEach(sheetName => {
        const worksheet = workbook.Sheets[sheetName];
        if (worksheet) {
          // Convert sheet to array of arrays
          const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
          const dataArray = jsonData as any[][];
          
          // Get headers (first row)
          const headers = dataArray.length > 0 ? dataArray[0].map(String) : [];
          
          // Get data rows (skip header)
          const dataRows = dataArray.slice(1);
          
          processedSheets.push({
            name: sheetName,
            data: dataRows,
            headers: headers
          });
        }
      });

      setSheets(processedSheets);
      setCurrentSheetIndex(0);
    } catch (err) {
      debugError('Error processing Excel file:', err);
      setError('Failed to process Excel file. Please check the file format.');
    } finally {
      setLoading(false);
    }
  };

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const uploadedFile = event.target.files?.[0];
    if (uploadedFile) {
      processExcelFile(uploadedFile, uploadedFile.name);
    }
  };

  const handleDownload = () => {
    if (sheets.length === 0) return;

    // Create a new workbook with the current data
    const workbook = XLSX.utils.book_new();
    
    sheets.forEach(sheet => {
      // Combine headers and data
      const sheetData = [sheet.headers, ...sheet.data];
      const worksheet = XLSX.utils.aoa_to_sheet(sheetData);
      XLSX.utils.book_append_sheet(workbook, worksheet, sheet.name);
    });

    // Generate and download
    const excelBuffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
    const blob = new Blob([excelBuffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName || 'viewed_excel_file.xlsx';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
  };

  // Process file when dialog opens
  React.useEffect(() => {
    if (open && (file || data)) {
      if (file) {
        processExcelFile(file, file.name);
      } else if (data) {
        processExcelFile(data, fileName || 'excel_file.xlsx');
      }
    }
  }, [open, file, data, fileName]);

  const currentSheet = sheets[currentSheetIndex];

  return (
    <Dialog open={open} onClose={onClose} maxWidth="lg" fullWidth>
      <DialogTitle>
        <Box display="flex" justifyContent="space-between" alignItems="center">
          <Typography variant="h6">
            Excel File Viewer
            {fileName && (
              <Chip 
                label={fileName} 
                size="small" 
                sx={{ ml: 2 }} 
                color="primary" 
                variant="outlined"
              />
            )}
          </Typography>
          <IconButton onClick={onClose}>
            <CloseIcon />
          </IconButton>
        </Box>
      </DialogTitle>
      
      <DialogContent>
        {loading && (
          <Box display="flex" justifyContent="center" alignItems="center" p={3}>
            <CircularProgress />
            <Typography sx={{ ml: 2 }}>Processing Excel file...</Typography>
          </Box>
        )}

        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}

        {!loading && !error && (
          <Box>
            {/* File Upload Section */}
            <Box mb={2}>
              <input
                ref={fileInputRef}
                type="file"
                accept=".xlsx,.xls"
                onChange={handleFileUpload}
                style={{ display: 'none' }}
              />
              <Button
                variant="outlined"
                startIcon={<UploadIcon />}
                onClick={() => fileInputRef.current?.click()}
                sx={{ mr: 2 }}
              >
                Upload Excel File
              </Button>
              {sheets.length > 0 && (
                <Button
                  variant="contained"
                  startIcon={<DownloadIcon />}
                  onClick={handleDownload}
                >
                  Download Excel
                </Button>
              )}
            </Box>

            {/* Sheet Tabs */}
            {sheets.length > 1 && (
              <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 2 }}>
                <Tabs
                  value={currentSheetIndex}
                  onChange={(e, newValue) => setCurrentSheetIndex(newValue)}
                >
                  {sheets.map((sheet, index) => (
                    <Tab key={index} label={sheet.name} />
                  ))}
                </Tabs>
              </Box>
            )}

            {/* Sheet Information */}
            {currentSheet && (
              <Box mb={2}>
                <Typography variant="subtitle2" color="textSecondary">
                  Sheet: {currentSheet.name} | 
                  Rows: {currentSheet.data.length} | 
                  Columns: {currentSheet.headers.length}
                </Typography>
              </Box>
            )}

            {/* Data Table */}
            {currentSheet && currentSheet.data.length > 0 && (
              <TableContainer component={Paper} sx={{ maxHeight: 600 }}>
                <Table stickyHeader size="small">
                  <TableHead>
                    <TableRow>
                      {currentSheet.headers.map((header, index) => (
                        <TableCell key={index} sx={{ fontWeight: 'bold', backgroundColor: '#f5f5f5' }}>
                          {header || `Column ${index + 1}`}
                        </TableCell>
                      ))}
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {currentSheet.data.map((row, rowIndex) => (
                      <TableRow key={rowIndex} hover>
                        {currentSheet.headers.map((_, colIndex) => (
                          <TableCell key={colIndex}>
                            {row[colIndex] !== undefined ? String(row[colIndex]) : ''}
                          </TableCell>
                        ))}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            )}

            {currentSheet && currentSheet.data.length === 0 && (
              <Box p={3} textAlign="center">
                <Typography color="textSecondary">
                  This sheet is empty or contains no data.
                </Typography>
              </Box>
            )}

            {sheets.length === 0 && !loading && !error && (
              <Box p={3} textAlign="center">
                <Typography color="textSecondary">
                  No Excel file loaded. Please upload a file to view its contents.
                </Typography>
              </Box>
            )}
          </Box>
        )}
      </DialogContent>

      <DialogActions>
        <Button onClick={onClose}>Close</Button>
      </DialogActions>
    </Dialog>
  );
};
