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
  InputAdornment,
  Switch,
  FormControlLabel,
  FormControl,
  InputLabel,
  Select,
  MenuItem
} from '@mui/material';
import {
  Add,
  Edit,
  Delete,
  Save,
  Cancel,
  AttachMoney,
  DirectionsCar,
  Schedule,
  Home
} from '@mui/icons-material';
import { CostCenter } from '../services/costCenterApiService';
import { debugError } from '../config/debug';

interface PerDiemRule {
  id: string;
  costCenter: string;
  maxAmount: number;
  minHours: number;
  minMiles: number;
  minDistanceFromBase: number;
  description: string;
  useActualAmount: boolean;
  createdAt: string;
  updatedAt: string;
}

interface PerDiemRulesManagementProps {
  costCenters: CostCenter[];
}

export const PerDiemRulesManagement: React.FC<PerDiemRulesManagementProps> = ({ costCenters }) => {
  const [perDiemRules, setPerDiemRules] = useState<PerDiemRule[]>([]);
  const [loading, setLoading] = useState(true);
  const [showDialog, setShowDialog] = useState(false);
  const [editingRule, setEditingRule] = useState<PerDiemRule | null>(null);
  const [formData, setFormData] = useState({
    costCenter: '',
    maxAmount: 35,
    minHours: 0,
    minMiles: 0,
    minDistanceFromBase: 0,
    description: '',
    useActualAmount: false
  });
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const loadPerDiemRules = useCallback(async () => {
    try {
      setLoading(true);
      const apiUrl = process.env.REACT_APP_API_URL || 'http://localhost:3002';
      const response = await fetch(`${apiUrl}/api/per-diem-rules`);
      if (!response.ok) {
        throw new Error('Failed to load per diem rules');
      }
      const data = await response.json();
      setPerDiemRules(data);
      setError(null);
    } catch (error) {
      debugError('Error loading per diem rules:', error);
      setError('Failed to load per diem rules');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadPerDiemRules();
  }, [loadPerDiemRules]);

  const handleAddRule = () => {
    setEditingRule(null);
    setFormData({
      costCenter: '',
      maxAmount: 35,
      minHours: 0,
      minMiles: 0,
      minDistanceFromBase: 0,
      description: '',
      useActualAmount: false
    });
    setShowDialog(true);
    setError(null);
    setSuccess(null);
  };

  const handleEditRule = (rule: PerDiemRule) => {
    setEditingRule(rule);
    setFormData({
      costCenter: rule.costCenter,
      maxAmount: rule.maxAmount,
      minHours: rule.minHours,
      minMiles: rule.minMiles,
      minDistanceFromBase: rule.minDistanceFromBase,
      description: rule.description,
      useActualAmount: rule.useActualAmount
    });
    setShowDialog(true);
    setError(null);
    setSuccess(null);
  };

  const handleSaveRule = async () => {
    try {
      setError(null);
      
      if (!formData.costCenter) {
        setError('Cost center is required');
        return;
      }

      if (formData.maxAmount <= 0) {
        setError('Max amount must be greater than 0');
        return;
      }

      const ruleData = {
        ...formData,
        id: editingRule?.id,
        maxAmount: Number(formData.maxAmount),
        minHours: Number(formData.minHours),
        minMiles: Number(formData.minMiles),
        minDistanceFromBase: Number(formData.minDistanceFromBase)
      };

      const apiUrl = process.env.REACT_APP_API_URL || 'http://localhost:3002';
      const response = await fetch(`${apiUrl}/api/per-diem-rules`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(ruleData),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to save per diem rule');
      }

      setSuccess(editingRule ? 'Per diem rule updated successfully' : 'Per diem rule created successfully');
      setShowDialog(false);
      await loadPerDiemRules();
    } catch (error) {
      debugError('Error saving per diem rule:', error);
      setError(error instanceof Error ? error.message : 'Failed to save per diem rule');
    }
  };

  const handleDeleteRule = async (ruleId: string) => {
    if (!window.confirm('Are you sure you want to delete this per diem rule?')) {
      return;
    }

    try {
      const apiUrl = process.env.REACT_APP_API_URL || 'http://localhost:3002';
      const response = await fetch(`${apiUrl}/api/per-diem-rules/${ruleId}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to delete per diem rule');
      }

      setSuccess('Per diem rule deleted successfully');
      await loadPerDiemRules();
    } catch (error) {
      debugError('Error deleting per diem rule:', error);
      setError(error instanceof Error ? error.message : 'Failed to delete per diem rule');
    }
  };

  const getCostCenterName = (code: string) => {
    const costCenter = costCenters.find(cc => cc.code === code);
    return costCenter ? costCenter.name : code;
  };

  const activeCostCenters = costCenters.filter(cc => cc.isActive);

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h5" component="h2">
          Per Diem Rules Management
        </Typography>
        <Button
          variant="contained"
          startIcon={<Add />}
          onClick={handleAddRule}
          color="primary"
        >
          Add Per Diem Rule
        </Button>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      {success && (
        <Alert severity="success" sx={{ mb: 2 }} onClose={() => setSuccess(null)}>
          {success}
        </Alert>
      )}

      <Card>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            Current Per Diem Rules
          </Typography>
          
          <TableContainer component={Paper} sx={{ mt: 2 }}>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell><strong>Cost Center</strong></TableCell>
                  <TableCell align="right"><strong>Max Amount</strong></TableCell>
                  <TableCell align="right"><strong>Min Hours</strong></TableCell>
                  <TableCell align="right"><strong>Min Miles</strong></TableCell>
                  <TableCell align="right"><strong>Min Distance from Base</strong></TableCell>
                  <TableCell align="center"><strong>Use Actual Amount</strong></TableCell>
                  <TableCell align="center"><strong>Actions</strong></TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {perDiemRules.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} align="center">
                      {loading ? 'Loading...' : 'No per diem rules configured'}
                    </TableCell>
                  </TableRow>
                ) : (
                  perDiemRules.map((rule) => (
                    <TableRow key={rule.id}>
                      <TableCell>
                        <Box>
                          <Typography variant="body2" fontWeight="medium">
                            {getCostCenterName(rule.costCenter)}
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            {rule.costCenter}
                          </Typography>
                          {rule.description && (
                            <Typography variant="caption" display="block" color="text.secondary">
                              {rule.description}
                            </Typography>
                          )}
                        </Box>
                      </TableCell>
                      <TableCell align="right">
                        <Chip 
                          label={`$${rule.maxAmount.toFixed(2)}`} 
                          color="primary" 
                          size="small"
                          icon={<AttachMoney />}
                        />
                      </TableCell>
                      <TableCell align="right">
                        {rule.minHours > 0 ? (
                          <Chip 
                            label={`${rule.minHours}h`} 
                            color="info" 
                            size="small"
                            icon={<Schedule />}
                          />
                        ) : (
                          <Typography variant="body2" color="text.secondary">No minimum</Typography>
                        )}
                      </TableCell>
                      <TableCell align="right">
                        {rule.minMiles > 0 ? (
                          <Chip 
                            label={`${rule.minMiles} mi`} 
                            color="warning" 
                            size="small"
                            icon={<DirectionsCar />}
                          />
                        ) : (
                          <Typography variant="body2" color="text.secondary">No minimum</Typography>
                        )}
                      </TableCell>
                      <TableCell align="right">
                        {rule.minDistanceFromBase > 0 ? (
                          <Chip 
                            label={`${rule.minDistanceFromBase} mi`} 
                            color="secondary" 
                            size="small"
                            icon={<Home />}
                          />
                        ) : (
                          <Typography variant="body2" color="text.secondary">No minimum</Typography>
                        )}
                      </TableCell>
                      <TableCell align="center">
                        <Chip 
                          label={rule.useActualAmount ? 'Actual' : 'Fixed'} 
                          color={rule.useActualAmount ? 'success' : 'default'} 
                          size="small"
                        />
                      </TableCell>
                      <TableCell align="center">
                        <IconButton
                          size="small"
                          onClick={() => handleEditRule(rule)}
                          color="primary"
                        >
                          <Edit />
                        </IconButton>
                        <IconButton
                          size="small"
                          onClick={() => handleDeleteRule(rule.id)}
                          color="error"
                        >
                          <Delete />
                        </IconButton>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </TableContainer>
        </CardContent>
      </Card>

      {/* Add/Edit Rule Dialog */}
      <Dialog
        open={showDialog}
        onClose={() => setShowDialog(false)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>
          {editingRule ? 'Edit Per Diem Rule' : 'Add New Per Diem Rule'}
        </DialogTitle>
        <DialogContent>
          <Box sx={{ mt: 2, display: 'flex', flexDirection: 'column', gap: 2 }}>
            <FormControl fullWidth required>
              <InputLabel>Cost Center</InputLabel>
              <Select
                value={formData.costCenter}
                onChange={(e) => setFormData({ ...formData, costCenter: e.target.value })}
                label="Cost Center"
              >
                <MenuItem value="">
                  <em>Select a cost center</em>
                </MenuItem>
                {activeCostCenters.map((costCenter) => (
                  <MenuItem key={costCenter.code} value={costCenter.code}>
                    {costCenter.name} ({costCenter.code})
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            <TextField
              label="Max Amount ($)"
              type="number"
              value={formData.maxAmount}
              onChange={(e) => setFormData({ ...formData, maxAmount: Number(e.target.value) })}
              fullWidth
              required
              inputProps={{ min: 0, step: 0.01 }}
              InputProps={{
                startAdornment: <InputAdornment position="start">$</InputAdornment>,
              }}
            />

            <Box sx={{ display: 'flex', gap: 2 }}>
              <TextField
                label="Minimum Hours"
                type="number"
                value={formData.minHours}
                onChange={(e) => setFormData({ ...formData, minHours: Number(e.target.value) })}
                fullWidth
                inputProps={{ min: 0, step: 0.5 }}
                InputProps={{
                  startAdornment: <InputAdornment position="start">hrs</InputAdornment>,
                }}
              />
              <TextField
                label="Minimum Miles"
                type="number"
                value={formData.minMiles}
                onChange={(e) => setFormData({ ...formData, minMiles: Number(e.target.value) })}
                fullWidth
                inputProps={{ min: 0, step: 1 }}
                InputProps={{
                  startAdornment: <InputAdornment position="start">mi</InputAdornment>,
                }}
              />
            </Box>

            <TextField
              label="Minimum Distance from Base Address"
              type="number"
              value={formData.minDistanceFromBase}
              onChange={(e) => setFormData({ ...formData, minDistanceFromBase: Number(e.target.value) })}
              fullWidth
              inputProps={{ min: 0, step: 1 }}
              InputProps={{
                startAdornment: <InputAdornment position="start">mi</InputAdornment>,
              }}
              helperText="Minimum miles away from base address to qualify for per diem"
            />

            <FormControlLabel
              control={
                <Switch
                  checked={formData.useActualAmount}
                  onChange={(e) => setFormData({ ...formData, useActualAmount: e.target.checked })}
                />
              }
              label={
                <Box>
                  <Typography variant="body2">
                    Use actual amount spent (up to max)
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    If enabled, employees can claim their actual expenses up to the maximum amount instead of the fixed maximum
                  </Typography>
                </Box>
              }
            />

            <TextField
              label="Description"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              fullWidth
              multiline
              rows={2}
              placeholder="Optional description for this per diem rule..."
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowDialog(false)} startIcon={<Cancel />}>
            Cancel
          </Button>
          <Button onClick={handleSaveRule} variant="contained" startIcon={<Save />}>
            {editingRule ? 'Update Rule' : 'Create Rule'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};
