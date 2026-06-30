import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Box,
  Button,
  Card,
  CardContent,
  IconButton,
  List,
  ListItem,
  ListItemText,
  TextField,
  Typography,
  CircularProgress,
} from '@mui/material';
import {
  Delete as DeleteIcon,
  ArrowUpward as ArrowUpwardIcon,
  ArrowDownward as ArrowDownwardIcon,
  Add as AddIcon,
} from '@mui/icons-material';
import { debugError } from '../config/debug';

const API_BASE_URL = process.env.REACT_APP_API_URL || 'https://oxford-mileage-backend.onrender.com';

interface FlockHouseRow {
  id: string;
  employeeId: string;
  oxfordHouseId: string;
  sortOrder: number;
}

interface OxfordHouseRow {
  id: string;
  name: string;
  address: string;
  city: string;
  state: string;
  zipCode: string;
  phoneNumber?: string;
}

interface MyFlockManagementProps {
  employeeId: string;
}

function getAuthHeaders(): HeadersInit {
  const token = localStorage.getItem('authToken');
  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

function formatHouseAddress(house: OxfordHouseRow): string {
  return `${house.address}, ${house.city}, ${house.state} ${house.zipCode}`.trim();
}

const MyFlockManagement: React.FC<MyFlockManagementProps> = ({ employeeId }) => {
  const [flockRows, setFlockRows] = useState<FlockHouseRow[]>([]);
  const [oxfordHouses, setOxfordHouses] = useState<OxfordHouseRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [saving, setSaving] = useState(false);

  const loadFlock = useCallback(async () => {
    const response = await fetch(
      `${API_BASE_URL}/api/flock-houses?employeeId=${encodeURIComponent(employeeId)}`,
      { headers: getAuthHeaders() }
    );
    if (!response.ok) {
      throw new Error(`Failed to load flock (${response.status})`);
    }
    const data = (await response.json()) as FlockHouseRow[];
    setFlockRows(
      [...(data || [])].sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0) || a.id.localeCompare(b.id))
    );
  }, [employeeId]);

  const loadOxfordHouses = useCallback(async () => {
    const response = await fetch(`${API_BASE_URL}/api/oxford-houses`);
    if (!response.ok) {
      throw new Error(`Failed to load Oxford Houses (${response.status})`);
    }
    const data = (await response.json()) as OxfordHouseRow[];
    setOxfordHouses(data || []);
  }, []);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      await Promise.all([loadFlock(), loadOxfordHouses()]);
    } catch (error) {
      debugError('MyFlockManagement: load failed', error);
    } finally {
      setLoading(false);
    }
  }, [loadFlock, loadOxfordHouses]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const houseById = useMemo(() => {
    const map = new Map<string, OxfordHouseRow>();
    oxfordHouses.forEach((house) => map.set(house.id, house));
    return map;
  }, [oxfordHouses]);

  const flockHouseIds = useMemo(() => new Set(flockRows.map((row) => row.oxfordHouseId)), [flockRows]);

  const searchResults = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return [];
    return oxfordHouses
      .filter((house) => !flockHouseIds.has(house.id))
      .filter((house) => {
        const address = formatHouseAddress(house);
        return (
          house.name.toLowerCase().includes(q) ||
          address.toLowerCase().includes(q) ||
          house.city.toLowerCase().includes(q) ||
          house.state.toLowerCase().includes(q)
        );
      })
      .slice(0, 12);
  }, [oxfordHouses, flockHouseIds, searchQuery]);

  const handleAdd = async (house: OxfordHouseRow) => {
    setSaving(true);
    try {
      const response = await fetch(`${API_BASE_URL}/api/flock-houses`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({
          employeeId,
          oxfordHouseId: house.id,
          sortOrder: flockRows.length,
        }),
      });
      if (!response.ok) {
        const err = await response.text();
        throw new Error(err || `Add failed (${response.status})`);
      }
      setSearchQuery('');
      await loadFlock();
    } catch (error) {
      debugError('MyFlockManagement: add failed', error);
      window.alert('Could not add this house to My Flock.');
    } finally {
      setSaving(false);
    }
  };

  const handleRemove = async (row: FlockHouseRow) => {
    const house = houseById.get(row.oxfordHouseId);
    const label = house?.name || 'this house';
    if (!window.confirm(`Remove "${label}" from My Flock?`)) return;

    setSaving(true);
    try {
      const response = await fetch(`${API_BASE_URL}/api/flock-houses/${row.id}`, {
        method: 'DELETE',
        headers: getAuthHeaders(),
      });
      if (!response.ok) {
        throw new Error(`Delete failed (${response.status})`);
      }
      await loadFlock();
    } catch (error) {
      debugError('MyFlockManagement: remove failed', error);
      window.alert('Could not remove this house from My Flock.');
    } finally {
      setSaving(false);
    }
  };

  const handleMove = async (index: number, direction: 'up' | 'down') => {
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= flockRows.length) return;

    const reordered = [...flockRows];
    [reordered[index], reordered[targetIndex]] = [reordered[targetIndex], reordered[index]];

    setSaving(true);
    try {
      for (let i = 0; i < reordered.length; i++) {
        if (reordered[i].sortOrder === i) continue;
        await fetch(`${API_BASE_URL}/api/flock-houses/${reordered[i].id}`, {
          method: 'PUT',
          headers: getAuthHeaders(),
          body: JSON.stringify({
            employeeId,
            oxfordHouseId: reordered[i].oxfordHouseId,
            sortOrder: i,
          }),
        });
      }
      await loadFlock();
    } catch (error) {
      debugError('MyFlockManagement: reorder failed', error);
      window.alert('Could not reorder My Flock.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card>
      <CardContent>
        <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <span role="img" aria-label="sheep">🐑</span>
          Manage My Flock
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          Pin Oxford Houses you visit often. Your flock syncs to the mobile app for quick location picking during GPS and manual mileage entry.
        </Typography>

        <TextField
          fullWidth
          size="small"
          label="Search Oxford Houses to add"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          sx={{ mb: 2 }}
          disabled={loading || saving}
        />

        {searchQuery.trim() ? (
          <List dense sx={{ mb: 2, border: 1, borderColor: 'divider', borderRadius: 1 }}>
            {searchResults.length === 0 ? (
              <ListItem>
                <ListItemText primary="No matching houses (or already in your flock)" />
              </ListItem>
            ) : (
              searchResults.map((house) => (
                <ListItem
                  key={house.id}
                  secondaryAction={
                    <Button
                      size="small"
                      startIcon={<AddIcon />}
                      onClick={() => void handleAdd(house)}
                      disabled={saving}
                    >
                      Add
                    </Button>
                  }
                >
                  <ListItemText
                    primary={house.name}
                    secondary={formatHouseAddress(house)}
                  />
                </ListItem>
              ))
            )}
          </List>
        ) : null}

        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 3 }}>
            <CircularProgress size={28} />
          </Box>
        ) : flockRows.length === 0 ? (
          <Typography variant="body2" color="text.secondary">
            Your flock is empty. Search above to add Oxford Houses.
          </Typography>
        ) : (
          <List dense>
            {flockRows.map((row, index) => {
              const house = houseById.get(row.oxfordHouseId);
              return (
                <ListItem
                  key={row.id}
                  sx={{ border: 1, borderColor: 'divider', borderRadius: 1, mb: 1 }}
                  secondaryAction={
                    <Box sx={{ display: 'flex', alignItems: 'center' }}>
                      <IconButton
                        size="small"
                        onClick={() => void handleMove(index, 'up')}
                        disabled={saving || index === 0}
                      >
                        <ArrowUpwardIcon fontSize="small" />
                      </IconButton>
                      <IconButton
                        size="small"
                        onClick={() => void handleMove(index, 'down')}
                        disabled={saving || index === flockRows.length - 1}
                      >
                        <ArrowDownwardIcon fontSize="small" />
                      </IconButton>
                      <IconButton
                        size="small"
                        color="error"
                        onClick={() => void handleRemove(row)}
                        disabled={saving}
                      >
                        <DeleteIcon fontSize="small" />
                      </IconButton>
                    </Box>
                  }
                >
                  <ListItemText
                    primary={
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <span role="img" aria-label="sheep">🐑</span>
                        <span>{house?.name || `House ${row.oxfordHouseId}`}</span>
                      </Box>
                    }
                    secondary={house ? formatHouseAddress(house) : 'Oxford House record not found'}
                  />
                </ListItem>
              );
            })}
          </List>
        )}
      </CardContent>
    </Card>
  );
};

export default MyFlockManagement;
