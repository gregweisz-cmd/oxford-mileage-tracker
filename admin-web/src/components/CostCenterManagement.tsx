import React, { useState, useEffect } from 'react';
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
  InputAdornment
} from '@mui/material';
import {
  Add,
  Edit,
  Delete,
  Search,
  Save,
  Cancel
} from '@mui/icons-material';

interface CostCenter {
  id: string;
  code: string;
  name: string;
  description?: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

interface CostCenterManagementProps {
  onCostCentersChange?: (costCenters: string[]) => void;
}

export const CostCenterManagement: React.FC<CostCenterManagementProps> = ({ onCostCentersChange }) => {
  const [costCenters, setCostCenters] = useState<CostCenter[]>([]);
  const [loading, setLoading] = useState(true);
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

  useEffect(() => {
    loadCostCenters();
  }, []);

  const loadCostCenters = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/cost-centers');
      if (!response.ok) throw new Error('Failed to load cost centers');
      
      const data = await response.json();
      setCostCenters(data);
      
      // Notify parent component of cost centers change
      if (onCostCentersChange) {
        onCostCentersChange(data.map((cc: CostCenter) => cc.name));
      }
    } catch (error) {
      console.error('Error loading cost centers:', error);
      setError('Failed to load cost centers');
    } finally {
      setLoading(false);
    }
  };

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
      const response = await fetch(`/api/cost-centers/${id}`, {
        method: 'DELETE'
      });

      if (!response.ok) throw new Error('Failed to delete cost center');

      await loadCostCenters();
    } catch (error) {
      console.error('Error deleting cost center:', error);
      setError('Failed to delete cost center');
    }
  };

  const handleSaveCostCenter = async () => {
    if (!formData.name.trim()) {
      setError('Cost center name is required');
      return;
    }

    try {
      const url = editingCostCenter 
        ? `/api/cost-centers/${editingCostCenter.id}`
        : '/api/cost-centers';
      
      const method = editingCostCenter ? 'PUT' : 'POST';
      
      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(formData)
      });

      if (!response.ok) throw new Error(`Failed to ${editingCostCenter ? 'update' : 'create'} cost center`);

      await loadCostCenters();
      setShowDialog(false);
      setError(null);
    } catch (error) {
      console.error('Error saving cost center:', error);
      setError(`Failed to ${editingCostCenter ? 'update' : 'create'} cost center`);
    }
  };

  const handleCancel = () => {
    setShowDialog(false);
    setFormData({ code: '', name: '', description: '', isActive: true });
    setError(null);
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
                  <TableCell>Code</TableCell>
                  <TableCell>Name</TableCell>
                  <TableCell>Description</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell>Created</TableCell>
                  <TableCell>Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {filteredCostCenters.map((costCenter) => (
                  <TableRow key={costCenter.id}>
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
    </Box>
  );
};
