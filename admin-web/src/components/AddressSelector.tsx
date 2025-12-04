import React, { useState, useEffect, useCallback } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  List,
  ListItem,
  ListItemButton,
  ListItemText,
  Box,
  Typography,
  Tabs,
  Tab,
  IconButton,
  InputAdornment,
  Chip,
  Divider,
} from '@mui/material';
import {
  Close as CloseIcon,
  Search as SearchIcon,
  LocationOn as LocationIcon,
  Home as HomeIcon,
  Bookmark as BookmarkIcon,
  Business as BusinessIcon,
  Edit as EditIcon,
} from '@mui/icons-material';
import { debugLog, debugError } from '../config/debug';

// API configuration - use environment variable or default to localhost for development
const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:3002';

interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

function TabPanel(props: TabPanelProps) {
  const { children, value, index, ...other } = props;

  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`address-tabpanel-${index}`}
      aria-labelledby={`address-tab-${index}`}
      {...other}
    >
      {value === index && <Box sx={{ py: 2 }}>{children}</Box>}
    </div>
  );
}

interface AddressSelectorProps {
  open: boolean;
  onClose: () => void;
  onSelectAddress: (address: string, locationData?: any) => void;
  employeeId: string;
  title?: string;
}

interface SavedAddress {
  id: string;
  name: string;
  address: string;
  latitude?: number;
  longitude?: number;
}

interface OxfordHouse {
  name: string;
  address: string;
  city: string;
  state: string;
  zip: string;
}

const AddressSelector: React.FC<AddressSelectorProps> = ({
  open,
  onClose,
  onSelectAddress,
  employeeId,
  title = 'Select Address',
}) => {
  const [activeTab, setActiveTab] = useState(0);
  const [manualAddress, setManualAddress] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [baseAddresses, setBaseAddresses] = useState<string[]>([]);
  const [savedAddresses, setSavedAddresses] = useState<SavedAddress[]>([]);
  const [frequentAddresses, setFrequentAddresses] = useState<SavedAddress[]>([]);
  const [oxfordHouses, setOxfordHouses] = useState<OxfordHouse[]>([]);
  const [filteredOxfordHouses, setFilteredOxfordHouses] = useState<OxfordHouse[]>([]);
  const [selectedState, setSelectedState] = useState<string>('');
  const [availableStates, setAvailableStates] = useState<string[]>([]);
  // const [employeeBaseAddress, setEmployeeBaseAddress] = useState<string>(''); // Currently unused

  const loadEmployeeData = useCallback(async () => {
    try {
      // Load employee's base addresses
      const employeeResponse = await fetch(`${API_BASE_URL}/api/employees/${employeeId}`);
      let baseAddress = '';
      
      if (employeeResponse.ok) {
        const employee = await employeeResponse.json();
        const addresses = [];
        if (employee.baseAddress) {
          addresses.push(employee.baseAddress);
          baseAddress = employee.baseAddress;
          // setEmployeeBaseAddress(employee.baseAddress); // Currently unused
        }
        if (employee.baseAddress2) addresses.push(employee.baseAddress2);
        setBaseAddresses(addresses);
      }
      
      // Load Oxford Houses after we have the base address
      await loadOxfordHouses(baseAddress);
      
      // Load other addresses in parallel
      await Promise.all([
        loadSavedAddresses(),
        loadFrequentAddresses()
      ]);
    } catch (error) {
      debugError('Error loading employee data:', error);
    }
  }, [employeeId]);

  // Load employee data
  useEffect(() => {
    if (open && employeeId) {
      loadEmployeeData();
    }
  }, [open, employeeId, loadEmployeeData]);

  const loadSavedAddresses = async () => {
    try {
      // Load saved addresses (from saved_addresses table if exists)
      const savedResponse = await fetch(`${API_BASE_URL}/api/saved-addresses?employeeId=${employeeId}`);
      if (savedResponse.ok) {
        const saved = await savedResponse.json();
        setSavedAddresses(saved);
      }
    } catch (error) {
      debugError('Error loading saved addresses:', error);
    }
  };

  const loadFrequentAddresses = async () => {
    try {
      // Load frequent addresses from mileage entries
      const mileageResponse = await fetch(`${API_BASE_URL}/api/mileage-entries?employeeId=${employeeId}`);
      if (mileageResponse.ok) {
        const entries = await mileageResponse.json();
        
        // Count address occurrences
        const addressCount: { [key: string]: { count: number; location?: any } } = {};
        entries.forEach((entry: any) => {
          if (entry.startLocationAddress) {
            const key = entry.startLocationAddress;
            if (!addressCount[key]) {
              addressCount[key] = { 
                count: 0,
                location: {
                  name: entry.startLocationName,
                  address: entry.startLocationAddress,
                  latitude: entry.startLocationLat,
                  longitude: entry.startLocationLng,
                }
              };
            }
            addressCount[key].count++;
          }
          if (entry.endLocationAddress) {
            const key = entry.endLocationAddress;
            if (!addressCount[key]) {
              addressCount[key] = { 
                count: 0,
                location: {
                  name: entry.endLocationName,
                  address: entry.endLocationAddress,
                  latitude: entry.endLocationLat,
                  longitude: entry.endLocationLng,
                }
              };
            }
            addressCount[key].count++;
          }
        });

        // Get top 10 most frequent addresses
        const frequent = Object.entries(addressCount)
          .sort((a, b) => b[1].count - a[1].count)
          .slice(0, 10)
          .map(([address, data], index) => ({
            id: `freq-${index}`,
            name: data.location?.name || 'Frequent Location',
            address: address,
            latitude: data.location?.latitude,
            longitude: data.location?.longitude,
          }));
        
        setFrequentAddresses(frequent);
      }
    } catch (error) {
      debugError('Error loading employee addresses:', error);
    }
  };

  // Load employee data
  useEffect(() => {
    if (open && employeeId) {
      loadEmployeeData();
    }
  }, [open, employeeId, loadEmployeeData]);

  const loadOxfordHouses = async (baseAddress: string = '') => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/oxford-houses`);
      if (response.ok) {
        const houses = await response.json();
        setOxfordHouses(houses);
        
        // Extract unique states
        const states = Array.from(new Set(houses.map((h: OxfordHouse) => h.state))).sort();
        setAvailableStates(states as string[]);
        
        // Set default state filter based on employee's base address
        if (baseAddress) {
          const stateMatch = baseAddress.match(/,\s*([A-Z]{2})[\s,]/);
          const extractedState = stateMatch ? stateMatch[1] : null;
          
          if (extractedState && states.includes(extractedState)) {
            setSelectedState(extractedState);
            const filtered = houses.filter((h: OxfordHouse) => h.state === extractedState);
            setFilteredOxfordHouses(filtered);
            debugLog(`🗺️ Filtered to ${extractedState}: ${filtered.length} houses`);
          } else {
            setFilteredOxfordHouses(houses);
          }
        } else {
          setFilteredOxfordHouses(houses);
        }
      }
    } catch (error) {
      debugError('Error loading Oxford Houses:', error);
    }
  };

  const handleSearchOxfordHouses = (query: string) => {
    setSearchQuery(query);
    
    // Start with all houses or filtered by state
    let housesToSearch = selectedState
      ? oxfordHouses.filter((h) => h.state === selectedState)
      : oxfordHouses;
    
    if (!query.trim()) {
      setFilteredOxfordHouses(housesToSearch);
      return;
    }

    const searchLower = query.toLowerCase();
    const filtered = housesToSearch.filter(
      (house) =>
        house.name.toLowerCase().includes(searchLower) ||
        house.address.toLowerCase().includes(searchLower) ||
        house.city.toLowerCase().includes(searchLower) ||
        house.state.toLowerCase().includes(searchLower)
    );
    setFilteredOxfordHouses(filtered);
  };
  
  const handleStateFilterChange = (state: string) => {
    debugLog(`🗺️ Changing state filter to: ${state || 'All States'}`);
    setSelectedState(state);
    const filtered = state
      ? oxfordHouses.filter((h) => h.state === state)
      : oxfordHouses;
    debugLog(`🗺️ Filtered results: ${filtered.length} houses`);
    setFilteredOxfordHouses(filtered);
    setSearchQuery(''); // Clear search when changing state
  };

  const handleSelectAddress = (address: string, locationData?: any) => {
    // Call the parent's onSelectAddress function
    // The parent will handle closing the dialog after updating state
    onSelectAddress(address, locationData);
  };

  const handleClose = () => {
    setManualAddress('');
    setSearchQuery('');
    setActiveTab(0);
    onClose();
  };

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="md" fullWidth>
      <DialogTitle>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Typography variant="h6">{title}</Typography>
          <IconButton onClick={handleClose} size="small">
            <CloseIcon />
          </IconButton>
        </Box>
      </DialogTitle>
      
      <DialogContent>
        <Tabs
          value={activeTab}
          onChange={(e, newValue) => setActiveTab(newValue)}
          variant="scrollable"
          scrollButtons="auto"
        >
          <Tab icon={<HomeIcon />} label="Base Address" />
          <Tab icon={<BookmarkIcon />} label="Saved" />
          <Tab icon={<LocationIcon />} label="Frequent" />
          <Tab icon={<BusinessIcon />} label="Oxford Houses" />
          <Tab icon={<EditIcon />} label="Manual Entry" />
        </Tabs>

        {/* Base Addresses Tab */}
        <TabPanel value={activeTab} index={0}>
          {baseAddresses.length === 0 ? (
            <Typography variant="body2" color="textSecondary" sx={{ textAlign: 'center', py: 4 }}>
              No base addresses found
            </Typography>
          ) : (
            <List>
              {baseAddresses.map((address, index) => (
                <ListItem key={index} disablePadding>
                  <ListItemButton onClick={() => handleSelectAddress(address)}>
                    <ListItemText
                      primary="BA"
                      secondary={address}
                    />
                  </ListItemButton>
                </ListItem>
              ))}
            </List>
          )}
        </TabPanel>

        {/* Saved Addresses Tab */}
        <TabPanel value={activeTab} index={1}>
          {savedAddresses.length === 0 ? (
            <Typography variant="body2" color="textSecondary" sx={{ textAlign: 'center', py: 4 }}>
              No saved addresses found
            </Typography>
          ) : (
            <List>
              {savedAddresses.map((saved) => (
                <ListItem key={saved.id} disablePadding>
                  <ListItemButton
                    onClick={() =>
                      handleSelectAddress(saved.address, {
                        name: saved.name,
                        latitude: saved.latitude,
                        longitude: saved.longitude,
                      })
                    }
                  >
                    <ListItemText primary={saved.name} secondary={saved.address} />
                  </ListItemButton>
                </ListItem>
              ))}
            </List>
          )}
        </TabPanel>

        {/* Frequent Addresses Tab */}
        <TabPanel value={activeTab} index={2}>
          {frequentAddresses.length === 0 ? (
            <Typography variant="body2" color="textSecondary" sx={{ textAlign: 'center', py: 4 }}>
              No frequent addresses found
            </Typography>
          ) : (
            <List>
              {frequentAddresses.map((frequent) => (
                <ListItem key={frequent.id} disablePadding>
                  <ListItemButton
                    onClick={() =>
                      handleSelectAddress(frequent.address, {
                        name: frequent.name,
                        latitude: frequent.latitude,
                        longitude: frequent.longitude,
                      })
                    }
                  >
                    <ListItemText primary={frequent.name} secondary={frequent.address} />
                  </ListItemButton>
                </ListItem>
              ))}
            </List>
          )}
        </TabPanel>

        {/* Oxford Houses Tab */}
        <TabPanel value={activeTab} index={3}>
          <TextField
            fullWidth
            placeholder="Search Oxford Houses..."
            value={searchQuery}
            onChange={(e) => handleSearchOxfordHouses(e.target.value)}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon />
                </InputAdornment>
              ),
            }}
            sx={{ mb: 2 }}
          />
          
          {/* State Filter */}
          {availableStates.length > 0 && (
            <Box sx={{ mb: 2 }}>
              <Typography variant="body2" sx={{ mb: 1, fontWeight: 600 }}>
                Filter by State:
              </Typography>
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                <Chip
                  label="All States"
                  size="small"
                  onClick={() => handleStateFilterChange('')}
                  color={!selectedState ? 'primary' : 'default'}
                  variant={!selectedState ? 'filled' : 'outlined'}
                />
                {availableStates.map((state) => (
                  <Chip
                    key={state}
                    label={state}
                    size="small"
                    onClick={() => handleStateFilterChange(state)}
                    color={selectedState === state ? 'primary' : 'default'}
                    variant={selectedState === state ? 'filled' : 'outlined'}
                  />
                ))}
              </Box>
            </Box>
          )}
          {filteredOxfordHouses.length === 0 ? (
            <Typography variant="body2" color="textSecondary" sx={{ textAlign: 'center', py: 4 }}>
              {searchQuery ? 'No matching Oxford Houses found' : 'No Oxford Houses available'}
            </Typography>
          ) : (
            <List sx={{ maxHeight: 400, overflow: 'auto' }}>
              {filteredOxfordHouses.map((house, index) => {
                const formattedAddress = `${house.name} (${house.address}, ${house.city}, ${house.state} ${house.zip})`;
                return (
                  <React.Fragment key={index}>
                    <ListItem disablePadding>
                      <ListItemButton
                        onClick={() =>
                          handleSelectAddress(
                            formattedAddress,
                            { name: house.name, fullAddress: formattedAddress }
                          )
                        }
                      >
                        <ListItemText
                          primary={house.name}
                          secondary={`${house.address}, ${house.city}, ${house.state} ${house.zip}`}
                        />
                      </ListItemButton>
                    </ListItem>
                    {index < filteredOxfordHouses.length - 1 && <Divider />}
                  </React.Fragment>
                );
              })}
            </List>
          )}
        </TabPanel>

        {/* Manual Entry Tab */}
        <TabPanel value={activeTab} index={4}>
          <TextField
            fullWidth
            multiline
            rows={3}
            label="Enter Address Manually"
            placeholder="123 Main St, City, State ZIP"
            value={manualAddress}
            onChange={(e) => setManualAddress(e.target.value)}
            helperText="Enter the full address including street, city, state, and ZIP code"
          />
          <Box sx={{ mt: 2, display: 'flex', justifyContent: 'flex-end' }}>
            <Button
              variant="contained"
              onClick={() => handleSelectAddress(manualAddress)}
              disabled={!manualAddress.trim()}
            >
              Use This Address
            </Button>
          </Box>
        </TabPanel>
      </DialogContent>

      <DialogActions>
        <Button onClick={handleClose}>Cancel</Button>
      </DialogActions>
    </Dialog>
  );
};

export default AddressSelector;

