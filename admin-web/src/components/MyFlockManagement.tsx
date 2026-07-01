import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  IconButton,
  List,
  ListItem,
  ListItemText,
  Paper,
  TextField,
  Typography,
  CircularProgress,
  Divider,
} from '@mui/material';
import { alpha, useTheme } from '@mui/material/styles';
import {
  Delete as DeleteIcon,
  Add as AddIcon,
  Search as SearchIcon,
} from '@mui/icons-material';
import { debugError } from '../config/debug';
import {
  normalizeOxfordHouseList,
  resolveOxfordHouseByStoredId,
  type OxfordHouseLike,
} from '../utils/oxfordHouseId';

const API_BASE_URL = process.env.REACT_APP_API_URL || 'https://oxford-mileage-backend.onrender.com';

interface FlockHouseRow {
  id: string;
  employeeId: string;
  oxfordHouseId: string;
  sortOrder: number;
  house?: OxfordHouseRow | null;
}

interface OxfordHouseRow {
  id: string;
  name: string;
  address: string;
  city: string;
  state: string;
  zipCode: string;
  zip?: string;
  phoneNumber?: string;
}

interface MyFlockManagementProps {
  employeeId: string;
  /** Full base address line — used to default the Oxford House state filter */
  baseAddress?: string;
}

function extractStateFromBaseAddress(baseAddress: string): string {
  const trimmed = (baseAddress || '').trim();
  if (!trimmed) return '';
  const stateMatch = trimmed.match(/,\s*([A-Z]{2})(?:\s+\d{5}(?:-\d{4})?)?\s*$/i);
  if (stateMatch) return stateMatch[1].toUpperCase();
  const fallback = trimmed.match(/\b([A-Z]{2})\b/g);
  return fallback?.length ? fallback[fallback.length - 1].toUpperCase() : '';
}

function normalizeState(state: string): string {
  return (state || '').trim().toUpperCase().slice(0, 2);
}

function getAuthHeaders(): HeadersInit {
  const token = localStorage.getItem('authToken');
  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

function formatHouseAddress(house: OxfordHouseRow): string {
  const zip = house.zipCode || house.zip || '';
  return `${house.address}, ${house.city}, ${house.state} ${zip}`.trim();
}

function resolveFlockHouse(row: FlockHouseRow, houses: OxfordHouseRow[]): OxfordHouseRow | null {
  if (row.house?.name) {
    return {
      ...row.house,
      zipCode: row.house.zipCode || row.house.zip || '',
    };
  }
  const resolved = resolveOxfordHouseByStoredId(row.oxfordHouseId, houses as OxfordHouseLike[]);
  if (!resolved) return null;
  return {
    ...resolved,
    zipCode: resolved.zipCode || resolved.zip || '',
  };
}

const MyFlockManagement: React.FC<MyFlockManagementProps> = ({ employeeId, baseAddress = '' }) => {
  const theme = useTheme();
  const [flockRows, setFlockRows] = useState<FlockHouseRow[]>([]);
  const [oxfordHouses, setOxfordHouses] = useState<OxfordHouseRow[]>([]);
  const [availableStates, setAvailableStates] = useState<string[]>([]);
  const [selectedState, setSelectedState] = useState('');
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [saving, setSaving] = useState(false);

  const flockPanelSx = {
    p: 2,
    borderRadius: 2,
    border: '1px solid',
    borderColor: 'divider',
    bgcolor:
      theme.palette.mode === 'dark'
        ? alpha(theme.palette.primary.main, 0.12)
        : alpha(theme.palette.primary.main, 0.06),
    borderLeft: `4px solid ${theme.palette.primary.main}`,
  } as const;

  const searchPanelSx = {
    p: 2,
    borderRadius: 2,
    border: '1px solid',
    borderColor: 'divider',
    bgcolor: 'background.paper',
  } as const;

  const loadFlock = useCallback(async () => {
    const response = await fetch(
      `${API_BASE_URL}/api/flock-houses?employeeId=${encodeURIComponent(employeeId)}`,
      { headers: getAuthHeaders() }
    );
    if (!response.ok) {
      throw new Error(`Failed to load flock (${response.status})`);
    }
    const data = (await response.json()) as FlockHouseRow[];
    setFlockRows(data || []);
  }, [employeeId]);

  const loadOxfordHouses = useCallback(async () => {
    const response = await fetch(`${API_BASE_URL}/api/oxford-houses`);
    if (!response.ok) {
      throw new Error(`Failed to load Oxford Houses (${response.status})`);
    }
    const data = (await response.json()) as Record<string, unknown>[];
    const houses = normalizeOxfordHouseList(data) as OxfordHouseRow[];
    setOxfordHouses(houses);

    const states = Array.from(
      new Set(houses.map((house) => normalizeState(house.state)).filter(Boolean))
    ).sort();
    setAvailableStates(states);

    const extractedState = extractStateFromBaseAddress(baseAddress);
    if (extractedState && states.includes(extractedState)) {
      setSelectedState(extractedState);
    } else {
      setSelectedState('');
    }
  }, [baseAddress]);

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
    oxfordHouses.forEach((house, index) => {
      map.set(house.id, house);
      map.set(`oh_${index}`, house);
    });
    return map;
  }, [oxfordHouses]);

  const resolvedFlockRows = useMemo(() => {
    return flockRows.map((row) => ({
      ...row,
      resolvedHouse: resolveFlockHouse(row, oxfordHouses),
    }));
  }, [flockRows, oxfordHouses]);

  const flockHouseIds = useMemo(() => new Set(flockRows.map((row) => row.oxfordHouseId)), [flockRows]);

  const sortedFlockRows = useMemo(() => {
    return [...resolvedFlockRows].sort((a, b) => {
      const nameA = (a.resolvedHouse?.name || a.oxfordHouseId).toLowerCase();
      const nameB = (b.resolvedHouse?.name || b.oxfordHouseId).toLowerCase();
      return nameA.localeCompare(nameB, undefined, { sensitivity: 'base' });
    });
  }, [resolvedFlockRows]);

  const housesInSelectedState = useMemo(() => {
    const notInFlock = oxfordHouses.filter((house) => !flockHouseIds.has(house.id));
    if (!selectedState) return notInFlock;
    return notInFlock.filter(
      (house) => normalizeState(house.state) === normalizeState(selectedState)
    );
  }, [oxfordHouses, flockHouseIds, selectedState]);

  const searchResults = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    const pool = housesInSelectedState;
    if (!q) return pool.slice(0, 12).sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }));

    return pool
      .filter((house) => {
        const address = formatHouseAddress(house);
        return (
          house.name.toLowerCase().includes(q) ||
          address.toLowerCase().includes(q) ||
          house.city.toLowerCase().includes(q) ||
          house.state.toLowerCase().includes(q)
        );
      })
      .sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }))
      .slice(0, 12);
  }, [housesInSelectedState, searchQuery]);

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
      await loadFlock();
    } catch (error) {
      debugError('MyFlockManagement: add failed', error);
      window.alert('Could not add this house to My Flock.');
    } finally {
      setSaving(false);
    }
  };

  const handleRemove = async (row: FlockHouseRow & { resolvedHouse?: OxfordHouseRow | null }) => {
    const label = row.resolvedHouse?.name || houseById.get(row.oxfordHouseId)?.name || 'this house';
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

  return (
    <Card>
      <CardContent>
        <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <span role="img" aria-label="sheep">🐑</span>
          Manage My Flock
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
          Pin Oxford Houses you visit often. Your flock syncs to the mobile app for quick location picking during GPS and manual mileage entry.
        </Typography>

        {/* —— Saved flock —— */}
        <Paper elevation={0} sx={{ ...flockPanelSx, mb: 3 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1.5 }}>
            <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
              My Flock
            </Typography>
            <Chip
              size="small"
              label={loading ? '…' : `${flockRows.length} ${flockRows.length === 1 ? 'house' : 'houses'}`}
              color="primary"
              variant="outlined"
            />
          </Box>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Houses you have pinned. These appear in the mobile app and mileage location picker.
          </Typography>

          {loading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 3 }}>
              <CircularProgress size={28} />
            </Box>
          ) : flockRows.length === 0 ? (
            <Box
              sx={{
                py: 3,
                px: 2,
                textAlign: 'center',
                borderRadius: 1,
                border: '1px dashed',
                borderColor: 'divider',
                bgcolor: 'background.paper',
              }}
            >
              <Typography variant="body2" color="text.secondary">
                Your flock is empty. Use the search section below to add Oxford Houses.
              </Typography>
            </Box>
          ) : (
            <List dense disablePadding sx={{ maxHeight: 320, overflowY: 'auto' }}>
              {sortedFlockRows.map((row) => {
                const house = row.resolvedHouse || houseById.get(row.oxfordHouseId) || null;
                return (
                  <ListItem
                    key={row.id}
                    sx={{
                      border: 1,
                      borderColor: 'divider',
                      borderRadius: 1,
                      mb: 1,
                      bgcolor: 'background.paper',
                    }}
                    secondaryAction={
                      <IconButton
                        size="small"
                        color="error"
                        onClick={() => void handleRemove(row)}
                        disabled={saving}
                        aria-label={`Remove ${house?.name || 'house'} from flock`}
                      >
                        <DeleteIcon fontSize="small" />
                      </IconButton>
                    }
                  >
                    <ListItemText
                      primary={
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <span role="img" aria-label="sheep">🐑</span>
                          <span>{house?.name || 'Oxford House'}</span>
                        </Box>
                      }
                      secondary={
                        house
                          ? formatHouseAddress(house)
                          : `Could not match house record (${row.oxfordHouseId})`
                      }
                    />
                  </ListItem>
                );
              })}
            </List>
          )}
        </Paper>

        <Divider sx={{ mb: 3 }} />

        {/* —— Search & add —— */}
        <Paper elevation={0} sx={searchPanelSx}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
            <SearchIcon fontSize="small" color="action" />
            <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
              Add Oxford Houses
            </Typography>
          </Box>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Search the directory and tap Add to pin a house to your flock.
          </Typography>

          <TextField
            fullWidth
            size="small"
            label="Search by name, city, or address"
            placeholder="e.g. OH 11th Street or Raleigh"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            sx={{ mb: 1.5 }}
            disabled={loading || saving}
          />

          {availableStates.length > 0 ? (
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mb: 2, alignItems: 'center' }}>
              <Typography variant="caption" color="text.secondary" sx={{ mr: 0.5 }}>
                Filter by state:
              </Typography>
              <Chip
                label="All States"
                size="small"
                onClick={() => setSelectedState('')}
                color={!selectedState ? 'primary' : 'default'}
                variant={!selectedState ? 'filled' : 'outlined'}
              />
              {availableStates.map((state) => (
                <Chip
                  key={state}
                  label={state}
                  size="small"
                  onClick={() => setSelectedState(state)}
                  color={selectedState === state ? 'primary' : 'default'}
                  variant={selectedState === state ? 'filled' : 'outlined'}
                />
              ))}
            </Box>
          ) : null}

          {loading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 2 }}>
              <CircularProgress size={24} />
            </Box>
          ) : searchResults.length > 0 ? (
            <List
              dense
              sx={{
                border: 1,
                borderColor: 'divider',
                borderRadius: 1,
                maxHeight: 280,
                overflowY: 'auto',
                bgcolor:
                  theme.palette.mode === 'dark'
                    ? alpha(theme.palette.common.white, 0.03)
                    : 'grey.50',
              }}
            >
              {searchResults.map((house) => (
                <ListItem
                  key={house.id}
                  divider
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
              ))}
            </List>
          ) : (
            <Typography variant="body2" color="text.secondary" sx={{ py: 2, textAlign: 'center' }}>
              {searchQuery.trim()
                ? `No matching houses${selectedState ? ` in ${selectedState}` : ''} (or already in your flock).`
                : selectedState
                  ? `No houses available in ${selectedState} to add. Try All States or another filter.`
                  : 'Type in the search box to find Oxford Houses to add.'}
            </Typography>
          )}
        </Paper>
      </CardContent>
    </Card>
  );
};

export default MyFlockManagement;
