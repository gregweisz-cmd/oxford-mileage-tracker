import React, { useState, useEffect, useCallback } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Button,
  TextField,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Alert,
  Chip,
  Tooltip,
  InputAdornment,
  Checkbox,
  Tabs,
  Tab,
  LinearProgress
} from '@mui/material';
import {
  Add,
  Edit,
  Delete,
  Search,
  Save,
  Cancel,
  CloudUpload,
  Download,
  Clear
} from '@mui/icons-material';
import { CostCenterApiService, CostCenter } from '../services/costCenterApiService';
import { PerDiemRulesManagement } from './PerDiemRulesManagement';

import { PerDiemRulesService } from '../services/perDiemRulesService';
import { debugError } from '../config/debug';

interface CostCenterManagementProps {
  onCostCentersChange?: (costCenters: string[]) => void;
}

export const CostCenterManagement: React.FC<CostCenterManagementProps> = ({ onCostCentersChange }) => {
  const [costCenters, setCostCenters] = useState<CostCenter[]>([]);
  // const [loading, setLoading] = useState(true); // Currently unused
  const [searchTerm, setSearchTerm] = useState('');
  const [showDialog, setShowDialog] = useState(false);
  const [editingCostCenter, setEditingCostCenter] = useState<CostCenter | null>(null);
  const [formData, setFormData] = useState({
    code: '',
    name: '',
    description: '',
    isActive: true
  });
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState(0);
  const [selectedCostCenters, setSelectedCostCenters] = useState<string[]>([]);
  const [csvData, setCsvData] = useState<string>('');
  const [isImporting, setIsImporting] = useState(false);
  const [importSuccess, setImportSuccess] = useState<string | null>(null);
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  
  // Per Diem Rules state
  const [showPerDiemDialog, setShowPerDiemDialog] = useState(false);
  const [editingPerDiemCostCenter, setEditingPerDiemCostCenter] = useState<CostCenter | null>(null);
  const [perDiemRules, setPerDiemRules] = useState<any>(null);

  const loadCostCenters = useCallback(async () => {
    try {
      // setLoading(true); // Loading state currently unused
      const data = await CostCenterApiService.getAllCostCenters();
      setCostCenters(data);
      
      // Notify parent component of cost centers change
      if (onCostCentersChange) {
        onCostCentersChange(data.map((cc: CostCenter) => cc.name));
      }
      setError(null);
    } catch (error) {
      debugError('Error loading cost centers:', error);
      setError('Failed to load cost centers');
    } finally {
      // setLoading(false); // Loading state currently unused
    }
  }, [onCostCentersChange]);

  useEffect(() => {
    loadCostCenters();
  }, [loadCostCenters]);

  const handleAddCostCenter = () => {
    setEditingCostCenter(null);
    setFormData({ code: '', name: '', description: '', isActive: true });
    setShowDialog(true);
    setError(null);
  };

  const handleEditCostCenter = (costCenter: CostCenter) => {
    setEditingCostCenter(costCenter);
    setFormData({
      code: costCenter.code,
      name: costCenter.name,
      description: costCenter.description || '',
      isActive: costCenter.isActive
    });
    setShowDialog(true);
    setError(null);
  };

  const handleDeleteCostCenter = async (id: string) => {
    if (!window.confirm('Are you sure you want to delete this cost center?')) {
      return;
    }

    try {
      await CostCenterApiService.deleteCostCenter(id);
      await loadCostCenters();
      setError(null);
    } catch (error) {
      debugError('Error deleting cost center:', error);
      setError('Failed to delete cost center');
    }
  };

  const handleSaveCostCenter = async () => {
    if (!formData.name.trim()) {
      setError('Cost center name is required');
      return;
    }

    try {
      if (editingCostCenter) {
        await CostCenterApiService.updateCostCenter(editingCostCenter.id, formData);
      } else {
        await CostCenterApiService.createCostCenter(formData);
      }

      await loadCostCenters();
      setShowDialog(false);
      setError(null);
    } catch (error) {
      debugError('Error saving cost center:', error);
      setError(`Failed to ${editingCostCenter ? 'update' : 'create'} cost center`);
    }
  };

  const handleCancel = () => {
    setShowDialog(false);
    setFormData({ code: '', name: '', description: '', isActive: true });
    setError(null);
  };

  const handleEditPerDiemRules = async (costCenter: CostCenter) => {
    try {
      // Fetch existing Per Diem rules for this cost center
      const existingRules = await PerDiemRulesService.getRulesByCostCenter(costCenter.name);
      
      if (existingRules) {
        setPerDiemRules(existingRules);
      } else {
        // Set default rules for this cost center
        setPerDiemRules({
          costCenter: costCenter.name,
          maxAmount: 35,
          minHours: 8,
          minMiles: 100,
          minDistanceFromBase: 50,
          description: 'Standard Per Diem rules',
          useActualAmount: false
        });
      }
      
      setEditingPerDiemCostCenter(costCenter);
      setShowPerDiemDialog(true);
    } catch (error) {
      debugError('Error loading Per Diem rules:', error);
      setError('Failed to load Per Diem rules');
    }
  };

  const handleSavePerDiemRules = async () => {
    if (!editingPerDiemCostCenter || !perDiemRules) return;

    try {
      // Save or update Per Diem rules
      await PerDiemRulesService.saveRules(perDiemRules);
      setShowPerDiemDialog(false);
      setEditingPerDiemCostCenter(null);
      setPerDiemRules(null);
      alert('Per Diem rules saved successfully!');
    } catch (error) {
      debugError('Error saving Per Diem rules:', error);
      setError('Failed to save Per Diem rules');
    }
  };

  const handleCancelPerDiemRules = () => {
    setShowPerDiemDialog(false);
    setEditingPerDiemCostCenter(null);
    setPerDiemRules(null);
  };

  // Multi-select handlers
  const handleSelectCostCenter = (id: string) => {
    setSelectedCostCenters(prev =>
      prev.includes(id) ? prev.filter(ccId => ccId !== id) : [...prev, id]
    );
  };

  const handleSelectAll = () => {
    setSelectedCostCenters(
      selectedCostCenters.length === filteredCostCenters.length
        ? []
        : filteredCostCenters.map(cc => cc.id)
    );
  };

  const handleBulkDelete = async () => {
    if (selectedCostCenters.length === 0) return;
    
    if (!window.confirm(`Are you sure you want to delete ${selectedCostCenters.length} cost centers?`)) {
      return;
    }

    try {
      // Delete each cost center
      await Promise.all(selectedCostCenters.map(id => 
        CostCenterApiService.deleteCostCenter(id)
      ));
      
      await loadCostCenters();
      setSelectedCostCenters([]);
      setError(null);
    } catch (error) {
      debugError('Error bulk deleting cost centers:', error);
      setError('Failed to delete some cost centers');
    }
  };

  // CSV Import handlers
  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      setCsvData(text);
    };
    reader.readAsText(file);
  };

  const handleDownloadTemplate = () => {
    const template = 'CODE,NAME,DESCRIPTION,IS_ACTIVE\nAL-SOR,Alabama - State Opioid Response,Alabama SOR Program,true\nOH-STATE,Ohio - State,Ohio State Program,true\n';
    const blob = new Blob([template], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'cost_center_template.csv';
    a.click();
    window.URL.revokeObjectURL(url);
  };

  const handleExportCostCenters = () => {
    const headers = 'CODE,NAME,DESCRIPTION,IS_ACTIVE\n';
    const rows = costCenters.map(cc => 
      `${cc.code},"${cc.name}","${cc.description || ''}",${cc.isActive}`
    ).join('\n');
    const csv = headers + rows;
    
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'cost_centers_export.csv';
    a.click();
    window.URL.revokeObjectURL(url);
  };

  const parseCsvData = (csv: string): CostCenter[] => {
    const lines = csv.split('\n').filter(line => line.trim());
    const headers = lines[0].split(',').map(h => h.trim().toUpperCase());
    
    const codeIndex = headers.indexOf('CODE');
    const nameIndex = headers.indexOf('NAME');
    const descIndex = headers.indexOf('DESCRIPTION');
    const activeIndex = headers.indexOf('IS_ACTIVE');

    return lines.slice(1).map(line => {
      const values = line.split(',').map(v => v.trim().replace(/^"|"$/g, ''));
      return {
        id: '',
        code: values[codeIndex] || '',
        name: values[nameIndex] || '',
        description: values[descIndex] || '',
        isActive: values[activeIndex]?.toLowerCase() === 'true',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
    });
  };

  const handleImportCsv = async () => {
    if (!csvData) return;

    setIsImporting(true);
    setError(null);
    setImportSuccess(null);

    try {
      const costCentersToImport = parseCsvData(csvData);
      let successCount = 0;
      let failCount = 0;

      for (const cc of costCentersToImport) {
        try {
          await CostCenterApiService.createCostCenter({
            code: cc.code,
            name: cc.name,
            description: cc.description,
            isActive: cc.isActive
          });
          successCount++;
        } catch (err) {
          debugError(`Failed to import ${cc.name}:`, err);
          failCount++;
        }
      }

      await loadCostCenters();
      setImportSuccess(`Successfully imported ${successCount} cost centers${failCount > 0 ? `, ${failCount} failed` : ''}`);
      setCsvData('');
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    } catch (error) {
      debugError('Error importing cost centers:', error);
      setError('Failed to import cost centers');
    } finally {
      setIsImporting(false);
    }
  };

  const filteredCostCenters = costCenters.filter(cc =>
    cc.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
    cc.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (cc.description && cc.description.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h4" gutterBottom>
        Cost Center Management
      </Typography>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      {importSuccess && (
        <Alert severity="success" sx={{ mb: 2 }} onClose={() => setImportSuccess(null)}>
          {importSuccess}
        </Alert>
      )}

      <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 3 }}>
        <Tabs value={activeTab} onChange={(e, newValue) => setActiveTab(newValue)}>
          <Tab label="Cost Centers" />
          <Tab label="Bulk Import" />
          <Tab label="Bulk Delete" />
        </Tabs>
      </Box>

      {/* Tab 0: Individual Cost Center Management */}
      {activeTab === 0 && (
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
            <Typography variant="h6">
              Cost Centers ({filteredCostCenters.length})
            </Typography>
            <Button
              variant="contained"
              startIcon={<Add />}
              onClick={handleAddCostCenter}
            >
              Add Cost Center
            </Button>
          </Box>

          <TextField
            fullWidth
            placeholder="Search cost centers..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <Search />
                </InputAdornment>
              )
            }}
            sx={{ mb: 2 }}
          />

          <TableContainer component={Paper}>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell padding="checkbox">
                    <Checkbox
                      indeterminate={selectedCostCenters.length > 0 && selectedCostCenters.length < filteredCostCenters.length}
                      checked={selectedCostCenters.length === filteredCostCenters.length && filteredCostCenters.length > 0}
                      onChange={handleSelectAll}
                    />
                  </TableCell>
                  <TableCell>Code</TableCell>
                  <TableCell>Name</TableCell>
                  <TableCell>Description</TableCell>
                  <TableCell>Per Diem Rules</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell>Created</TableCell>
                  <TableCell>Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {filteredCostCenters.map((costCenter) => (
                  <TableRow key={costCenter.id}>
                    <TableCell padding="checkbox">
                      <Checkbox
                        checked={selectedCostCenters.includes(costCenter.id)}
                        onChange={() => handleSelectCostCenter(costCenter.id)}
                      />
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2" color="text.secondary">
                        {costCenter.code}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Typography variant="body1" fontWeight="medium">
                        {costCenter.name}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2" color="text.secondary">
                        {costCenter.description || 'No description'}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Button
                        size="small"
                        variant="outlined"
                        onClick={() => handleEditPerDiemRules(costCenter)}
                        startIcon={<Edit />}
                      >
                        Edit Rules
                      </Button>
                    </TableCell>
                    <TableCell>
                      <Chip
                        label={costCenter.isActive ? 'Active' : 'Inactive'}
                        color={costCenter.isActive ? 'success' : 'default'}
                        size="small"
                      />
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2" color="text.secondary">
                        {new Date(costCenter.createdAt).toLocaleDateString()}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Tooltip title="Edit Cost Center">
                        <IconButton
                          size="small"
                          onClick={() => handleEditCostCenter(costCenter)}
                        >
                          <Edit />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="Delete Cost Center">
                        <IconButton
                          size="small"
                          onClick={() => handleDeleteCostCenter(costCenter.id)}
                          color="error"
                        >
                          <Delete />
                        </IconButton>
                      </Tooltip>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>

          {filteredCostCenters.length === 0 && (
            <Box sx={{ textAlign: 'center', py: 4 }}>
              <Typography variant="body1" color="text.secondary">
                {searchTerm ? 'No cost centers match your search' : 'No cost centers found'}
              </Typography>
            </Box>
          )}
        </CardContent>
      </Card>
      )}

      {/* Tab 1: Bulk Import */}
      {activeTab === 1 && (
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            Bulk Import Cost Centers
          </Typography>

          <Box sx={{ display: 'flex', gap: 2, mb: 2 }}>
            <Button
              variant="contained"
              startIcon={<CloudUpload />}
              onClick={() => fileInputRef.current?.click()}
            >
              Upload CSV File
            </Button>

            <Button
              variant="outlined"
              startIcon={<Download />}
              onClick={handleDownloadTemplate}
            >
              Download Template
            </Button>

            <Button
              variant="outlined"
              startIcon={<Download />}
              onClick={handleExportCostCenters}
            >
              Export Current Cost Centers
            </Button>
          </Box>

          <input
            ref={fileInputRef}
            type="file"
            accept=".csv"
            onChange={handleFileUpload}
            style={{ display: 'none' }}
          />

          {csvData && (
            <Box sx={{ mt: 2 }}>
              <Alert severity="info" sx={{ mb: 2 }}>
                CSV file loaded. Click "Import Cost Centers" to proceed.
              </Alert>
              
              <Button
                variant="contained"
                onClick={handleImportCsv}
                disabled={isImporting}
                sx={{ mb: 2 }}
              >
                {isImporting ? 'Importing...' : 'Import Cost Centers'}
              </Button>
              
              {isImporting && <LinearProgress sx={{ mb: 2 }} />}
              
              <Button
                variant="outlined"
                startIcon={<Clear />}
                onClick={() => {
                  setCsvData('');
                  if (fileInputRef.current) fileInputRef.current.value = '';
                }}
                sx={{ ml: 2 }}
              >
                Clear
              </Button>
            </Box>
          )}

          <Alert severity="info" sx={{ mt: 3 }}>
            <Typography variant="subtitle2" gutterBottom>CSV Format:</Typography>
            <Typography variant="body2">
              CODE,NAME,DESCRIPTION,IS_ACTIVE
              <br />
              Example: AL-SOR,Alabama - State Opioid Response,Alabama SOR Program,true
            </Typography>
          </Alert>
        </CardContent>
      </Card>
      )}

      {/* Tab 1: Bulk Import */}
      {activeTab === 1 && (
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            Bulk Import Cost Centers
          </Typography>

          <Alert severity="info" sx={{ mb: 2 }}>
            Upload a CSV file to import multiple cost centers at once. Use the template below for the correct format.
          </Alert>

          <Box sx={{ mb: 2 }}>
            <Button
              variant="outlined"
              startIcon={<Download />}
              onClick={handleDownloadTemplate}
              sx={{ mr: 2 }}
            >
              Download Template
            </Button>
            
            <Button
              variant="outlined"
              startIcon={<CloudUpload />}
              onClick={() => fileInputRef.current?.click()}
            >
              Upload CSV
            </Button>
            
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv"
              style={{ display: 'none' }}
              onChange={handleFileUpload}
            />
          </Box>

          {csvData && (
            <Box sx={{ mb: 2 }}>
              <Typography variant="subtitle2" gutterBottom>
                Preview ({csvData.split('\n').length - 1} rows):
              </Typography>
              <TextField
                fullWidth
                multiline
                rows={6}
                value={csvData}
                onChange={(e) => setCsvData(e.target.value)}
                variant="outlined"
                sx={{ mb: 2 }}
              />
              
              <Button
                variant="contained"
                startIcon={<CloudUpload />}
                onClick={handleImportCsv}
                disabled={isImporting}
                sx={{ mb: 2 }}
              >
                {isImporting ? 'Importing...' : 'Import Cost Centers'}
              </Button>
              
              {isImporting && <LinearProgress sx={{ mb: 2 }} />}
              
              <Button
                variant="outlined"
                startIcon={<Clear />}
                onClick={() => {
                  setCsvData('');
                  if (fileInputRef.current) fileInputRef.current.value = '';
                }}
                sx={{ ml: 2 }}
              >
                Clear
              </Button>
            </Box>
          )}

          <Alert severity="info" sx={{ mt: 3 }}>
            <Typography variant="subtitle2" gutterBottom>CSV Format:</Typography>
            <Typography variant="body2">
              CODE,NAME,DESCRIPTION,IS_ACTIVE
              <br />
              Example: AL-SOR,Alabama - State Opioid Response,Alabama SOR Program,true
            </Typography>
          </Alert>
        </CardContent>
      </Card>
      )}

      {/* Tab 2: Bulk Delete */}
      {activeTab === 2 && (
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            Bulk Delete Cost Centers
          </Typography>

          <Alert severity="warning" sx={{ mb: 2 }}>
            Select cost centers from the checkboxes in the Cost Centers tab, then use this tab to delete them all at once.
          </Alert>

          {selectedCostCenters.length > 0 && (
            <Box sx={{ mb: 2 }}>
              <Alert severity="info">
                {selectedCostCenters.length} cost center(s) selected
              </Alert>
              
              <Button
                variant="contained"
                color="error"
                startIcon={<Delete />}
                onClick={handleBulkDelete}
                sx={{ mt: 2 }}
              >
                Delete {selectedCostCenters.length} Cost Center(s)
              </Button>
            </Box>
          )}

          {selectedCostCenters.length === 0 && (
            <Alert severity="info">
              No cost centers selected. Go to the Cost Centers tab and select items using the checkboxes.
            </Alert>
          )}
        </CardContent>
      </Card>
      )}

      {/* Add/Edit Dialog */}
      <Dialog open={showDialog} onClose={handleCancel} maxWidth="sm" fullWidth>
        <DialogTitle>
          {editingCostCenter ? 'Edit Cost Center' : 'Add Cost Center'}
        </DialogTitle>
        <DialogContent>
          <Box sx={{ pt: 1 }}>
            <TextField
              fullWidth
              label="Cost Center Code"
              value={formData.code}
              onChange={(e) => setFormData({ ...formData, code: e.target.value })}
              margin="normal"
              placeholder="Auto-generated from name if empty"
              helperText="Leave empty to auto-generate from name"
            />
            
            <TextField
              fullWidth
              label="Cost Center Name"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              margin="normal"
              required
              error={!formData.name.trim() && error !== null}
              helperText={!formData.name.trim() && error ? 'Cost center name is required' : ''}
            />
            
            <TextField
              fullWidth
              label="Description"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              margin="normal"
              multiline
              rows={3}
              placeholder="Optional description for this cost center..."
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCancel} startIcon={<Cancel />}>
            Cancel
          </Button>
          <Button
            onClick={handleSaveCostCenter}
            variant="contained"
            startIcon={<Save />}
            disabled={!formData.name.trim()}
          >
            {editingCostCenter ? 'Update' : 'Create'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Per Diem Rules Dialog */}
      <Dialog open={showPerDiemDialog} onClose={handleCancelPerDiemRules} maxWidth="md" fullWidth>
        <DialogTitle>
          Per Diem Rules - {editingPerDiemCostCenter?.name}
        </DialogTitle>
        <DialogContent>
          {perDiemRules && (
            <Box sx={{ pt: 2 }}>
              <Alert severity="info" sx={{ mb: 3 }}>
                Configure Per Diem eligibility rules for <strong>{editingPerDiemCostCenter?.name}</strong>
              </Alert>

              <TextField
                fullWidth
                label="Max Per Diem Amount"
                type="number"
                value={perDiemRules.maxAmount || 35}
                onChange={(e) => setPerDiemRules({ ...perDiemRules, maxAmount: parseFloat(e.target.value) })}
                margin="normal"
                InputProps={{
                  startAdornment: <InputAdornment position="start">$</InputAdornment>
                }}
                helperText="Maximum Per Diem amount per day"
              />

              <TextField
                fullWidth
                label="Minimum Hours Worked"
                type="number"
                value={perDiemRules.minHours || 8}
                onChange={(e) => setPerDiemRules({ ...perDiemRules, minHours: parseFloat(e.target.value) })}
                margin="normal"
                helperText="Minimum hours worked to qualify for Per Diem"
              />

              <TextField
                fullWidth
                label="Minimum Miles Driven"
                type="number"
                value={perDiemRules.minMiles || 100}
                onChange={(e) => setPerDiemRules({ ...perDiemRules, minMiles: parseFloat(e.target.value) })}
                margin="normal"
                helperText="Minimum miles driven to qualify for Per Diem"
              />

              <TextField
                fullWidth
                label="Minimum Distance from Base"
                type="number"
                value={perDiemRules.minDistanceFromBase || 50}
                onChange={(e) => setPerDiemRules({ ...perDiemRules, minDistanceFromBase: parseFloat(e.target.value) })}
                margin="normal"
                InputProps={{
                  endAdornment: <InputAdornment position="end">miles</InputAdornment>
                }}
                helperText="Minimum distance from base address to qualify"
              />

              <TextField
                fullWidth
                label="Description"
                value={perDiemRules.description || ''}
                onChange={(e) => setPerDiemRules({ ...perDiemRules, description: e.target.value })}
                margin="normal"
                multiline
                rows={2}
                helperText="Optional description for these rules"
              />

              <Box sx={{ mt: 2, mb: 1 }}>
                <Typography variant="subtitle2" gutterBottom>
                  Per Diem Type:
                </Typography>
                <Box sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
                  <Chip
                    label="Fixed Amount ($35)"
                    color={!perDiemRules.useActualAmount ? 'primary' : 'default'}
                    onClick={() => setPerDiemRules({ ...perDiemRules, useActualAmount: false })}
                    sx={{ cursor: 'pointer' }}
                  />
                  <Chip
                    label="Actual Amount (up to max)"
                    color={perDiemRules.useActualAmount ? 'primary' : 'default'}
                    onClick={() => setPerDiemRules({ ...perDiemRules, useActualAmount: true })}
                    sx={{ cursor: 'pointer' }}
                  />
                </Box>
                <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
                  {!perDiemRules.useActualAmount 
                    ? 'Employees receive fixed $' + (perDiemRules.maxAmount || 35) + ' when eligible'
                    : 'Employees enter actual expenses up to $' + (perDiemRules.maxAmount || 35)
                  }
                </Typography>
              </Box>
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCancelPerDiemRules} startIcon={<Cancel />}>
            Cancel
          </Button>
          <Button onClick={handleSavePerDiemRules} variant="contained" startIcon={<Save />}>
            Save Rules
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};
