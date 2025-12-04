import React, { useState, useEffect } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  IconButton,
  Drawer,
  Button,
  FormControlLabel,
  Checkbox,
  Chip,
  CircularProgress,
  Tooltip,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  ToggleButton,
  ToggleButtonGroup,
  SelectChangeEvent,
  TextField,
  Divider,
} from '@mui/material';
import {
  Settings as SettingsIcon,
  TrendingUp,
  TrendingDown,
  AttachMoney,
  People,
  Receipt,
  Schedule,
  LocationOn,
  Assessment,
  CheckCircle,
  HourglassEmpty,
  DonutLarge,
  Save,
  DeleteOutline,
} from '@mui/icons-material';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  Tooltip as RechartsTooltip,
  XAxis,
  YAxis,
  CartesianGrid,
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
} from 'recharts';
import { Responsive, WidthProvider, Layout, Layouts } from 'react-grid-layout';
import 'react-grid-layout/css/styles.css';
import 'react-resizable/css/styles.css';

import { debugError } from '../config/debug';

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:3002';

interface Statistic {
  id: string;
  title: string;
  value: string | number;
  icon: React.ReactNode;
  color: string;
  trend?: {
    value: number;
    label: string;
  };
  subtitle?: string;
  metadata?: {
    availableStates?: string[];
    selectedState?: string;
    selectedStates?: string[];
    availableCostCenters?: string[];
    selectedCostCenter?: string;
    selectedCostCenters?: string[];
    trendData?: { monthKey: string; label: string; value: number }[];
    trendUnit?: 'currency' | 'count';
    periodLabel?: string;
    categories?: { id: string; label: string; value: number }[];
  };
}

interface DashboardStatisticsProps {
  userId: string;
  userRole: 'finance' | 'supervisor' | 'admin';
  dateRange?: {
    start: Date;
    end: Date;
  };
}

interface AvailableStatistic {
  id: string;
  title: string;
  description: string;
  icon: string;
  availableFor: ('finance' | 'supervisor' | 'admin')[];
}

interface CategoryPreset {
  id: string;
  name: string;
  states: string[];
  costCenters: string[];
  chartType: 'bar' | 'donut';
}

const AVAILABLE_STATISTICS: AvailableStatistic[] = [
  {
    id: 'total-expenses',
    title: 'Total Expenses',
    description: 'Total expense amount across all reports',
    icon: 'money',
    availableFor: ['finance', 'supervisor', 'admin'],
  },
  {
    id: 'pending-reports',
    title: 'Pending Reports',
    description: 'Number of reports awaiting review',
    icon: 'hourglass',
    availableFor: ['finance', 'supervisor', 'admin'],
  },
  {
    id: 'approved-reports',
    title: 'Approved Reports',
    description: 'Number of approved reports',
    icon: 'check',
    availableFor: ['finance', 'supervisor', 'admin'],
  },
  {
    id: 'total-receipts',
    title: 'Total Receipts',
    description: 'Total number of receipts submitted',
    icon: 'receipt',
    availableFor: ['finance', 'supervisor', 'admin'],
  },
  {
    id: 'total-miles',
    title: 'Total Miles',
    description: 'Total mileage across all reports',
    icon: 'location',
    availableFor: ['finance', 'supervisor', 'admin'],
  },
  {
    id: 'total-employees',
    title: 'Active Employees',
    description: 'Number of active employees',
    icon: 'people',
    availableFor: ['finance', 'admin'],
  },
  {
    id: 'team-members',
    title: 'Team Members',
    description: 'Number of employees in your team',
    icon: 'people',
    availableFor: ['supervisor'],
  },
  {
    id: 'average-expense',
    title: 'Average Expense per Report',
    description: 'Average expense amount per report',
    icon: 'assessment',
    availableFor: ['finance', 'supervisor', 'admin'],
  },
  {
    id: 'submissions-this-month',
    title: 'Submissions This Month',
    description: 'Reports submitted this month',
    icon: 'schedule',
    availableFor: ['finance', 'supervisor', 'admin'],
  },
  {
    id: 'expenses-trend',
    title: 'Expense Trend',
    description: 'Track monthly expense totals over time',
    icon: 'trend',
    availableFor: ['finance', 'supervisor', 'admin'],
  },
  {
    id: 'expenses-by-category',
    title: 'Expenses by Category',
    description: 'Visualize spending breakdown by category',
    icon: 'assessment',
    availableFor: ['finance', 'supervisor', 'admin'],
  },
  {
    id: 'expenses-by-state',
    title: 'Expenses by State',
    description: 'Breakdown of expenses by state',
    icon: 'location',
    availableFor: ['finance'],
  },
  {
    id: 'expenses-by-cost-center',
    title: 'Expenses by Cost Center',
    description: 'Breakdown of expenses by cost center',
    icon: 'assessment',
    availableFor: ['finance', 'supervisor', 'admin'],
  },
];

const CATEGORY_ALL_STATES_VALUE = '__ALL_STATES__';
const CATEGORY_ALL_COST_CENTERS_VALUE = '__ALL_COST_CENTERS__';
const CATEGORY_COLORS = ['#8e24aa', '#3949ab', '#039be5', '#00897b', '#fdd835', '#fb8c00', '#f4511e', '#6d4c41', '#546e7a'];
const CATEGORY_MENU_PROPS = { PaperProps: { style: { maxHeight: 260 } } };

const GRID_BREAKPOINTS = { lg: 1200, md: 996, sm: 768, xs: 480, xxs: 0 } as const;
const GRID_COLUMNS = { lg: 12, md: 10, sm: 6, xs: 4, xxs: 2 } as const;
type Breakpoint = keyof typeof GRID_COLUMNS;
const BREAKPOINT_KEYS = Object.keys(GRID_COLUMNS) as Breakpoint[];

const ResponsiveGridLayout = WidthProvider(Responsive);

const DEFAULT_WIDGET_CONFIG: Record<string, { w: number; h: number; minW?: number; minH?: number }> = {
  'expenses-by-category': { w: 3, h: 4, minW: 3, minH: 3 },
  'expenses-trend': { w: 3, h: 3, minW: 3, minH: 3 },
  default: { w: 3, h: 2, minW: 3, minH: 2 },
};

const getWidgetConfig = (statId: string) => {
  if (DEFAULT_WIDGET_CONFIG[statId]) {
    return DEFAULT_WIDGET_CONFIG[statId];
  }
  return DEFAULT_WIDGET_CONFIG.default;
};

const createEmptyLayouts = (): Layouts => {
  const empty = {} as Layouts;
  BREAKPOINT_KEYS.forEach((bp) => {
    empty[bp] = [];
  });
  return empty;
};

const applyWidgetHeights = (layouts: Layouts, heights: Record<string, { h: number; minH: number }>): Layouts => {
  const nextLayouts = createEmptyLayouts();
  BREAKPOINT_KEYS.forEach((bp) => {
    nextLayouts[bp] = layouts[bp].map((item) => {
      const overrides = heights[item.i];
      if (!overrides) {
        return { ...item };
      }
      return {
        ...item,
        h: overrides.h,
        minH: overrides.minH,
      };
    });
  });
  return nextLayouts;
};

const determineWidgetHeights = (stats: Statistic[]): Record<string, { h: number; minH: number }> => {
  const overrides: Record<string, { h: number; minH: number }> = {};

  stats.forEach((stat) => {
    let heightUnits = 2;

    switch (stat.id) {
      case 'expenses-by-category': {
        const categories = stat.metadata?.categories || [];
        const needsMoreSpace = categories.length > 4 || (stat.metadata?.selectedStates?.length || 0) > 0 || (stat.metadata?.selectedCostCenters?.length || 0) > 0;
        heightUnits = needsMoreSpace ? 5 : 4;
        break;
      }
      case 'expenses-trend': {
        heightUnits = 4;
        break;
      }
      case 'expenses-by-state':
      case 'expenses-by-cost-center': {
        heightUnits = 3;
        break;
      }
      case 'pending-reports':
      case 'approved-reports':
      case 'total-expenses':
      case 'submissions-this-month':
      default: {
        heightUnits = 2;
      }
    }

    const minH = Math.max(2, Math.min(heightUnits, DEFAULT_WIDGET_CONFIG[stat.id]?.minH ?? DEFAULT_WIDGET_CONFIG.default.minH ?? 2));
    overrides[stat.id] = { h: heightUnits, minH };
  });

  return overrides;
};

const ensureLayoutsForStats = (stats: string[], baseLayouts?: Partial<Layouts>): Layouts => {
  const nextLayouts = createEmptyLayouts();

  BREAKPOINT_KEYS.forEach((bp) => {
    const cols = GRID_COLUMNS[bp];
    const existingItems: Layout[] = baseLayouts?.[bp]
      ? (baseLayouts[bp] as Layout[]).filter((item: Layout) => stats.includes(item.i))
      : [];
    const existingMap = new Map<string, Layout>(existingItems.map((item: Layout) => [item.i, item]));

    const existingOrder = existingItems
      .slice()
      .sort((a, b) => (a.y - b.y) || (a.x - b.x))
      .map((item) => item.i);

    const placementSequence: string[] = [];
    const seen = new Set<string>();
    existingOrder.forEach((id) => {
      if (stats.includes(id) && !seen.has(id)) {
        placementSequence.push(id);
        seen.add(id);
      }
    });
    stats.forEach((id) => {
      if (!seen.has(id)) {
        placementSequence.push(id);
        seen.add(id);
      }
    });

    const layoutItems: Layout[] = [];
    let columnCursor = 0;
    let rowCursor = 0;
    let currentRowHeight = 0;

    placementSequence.forEach((statId) => {
      const config = getWidgetConfig(statId);
      const width = Math.min(config.w, cols);
      const height = Math.max(1, config.h);
      const minWidth = Math.min(config.minW ?? config.w, cols);
      const minHeight = Math.max(1, config.minH ?? config.h);

      if (columnCursor + width > cols) {
        columnCursor = 0;
        rowCursor += currentRowHeight || height;
        currentRowHeight = 0;
      }

      const x = columnCursor;
      const y = rowCursor;
      columnCursor += width;
      currentRowHeight = Math.max(currentRowHeight, height);

      const existing = existingMap.get(statId);
      const baseItem: Layout = existing
        ? { ...existing }
        : { i: statId, x, y, w: width, h: height };

      baseItem.x = x;
      baseItem.y = y;
      baseItem.w = width;
      baseItem.h = height;
      baseItem.minW = minWidth;
      baseItem.minH = minHeight;
      baseItem.isResizable = false;

      layoutItems.push(baseItem);
    });

    nextLayouts[bp] = layoutItems;
  });

  return nextLayouts;
};

const getIcon = (iconName: string) => {
  switch (iconName) {
    case 'money':
      return <AttachMoney />;
    case 'hourglass':
      return <HourglassEmpty />;
    case 'check':
      return <CheckCircle />;
    case 'receipt':
      return <Receipt />;
    case 'location':
      return <LocationOn />;
    case 'people':
      return <People />;
    case 'assessment':
      return <Assessment />;
    case 'schedule':
      return <Schedule />;
    case 'trend':
      return <TrendingUp />;
    default:
      return <Assessment />;
  }
};

export const DashboardStatistics: React.FC<DashboardStatisticsProps> = ({
  userId,
  userRole,
  dateRange,
}) => {
  const [statistics, setStatistics] = useState<Statistic[]>([]);
  const [loading, setLoading] = useState(true);
  const [customizeDialogOpen, setCustomizeDialogOpen] = useState(false);
  const [selectedStats, setSelectedStats] = useState<string[]>([]);
  const [availableStats, setAvailableStats] = useState<AvailableStatistic[]>([]);
  const [selectedState, setSelectedState] = useState<string>('');
  const [selectedCostCenter, setSelectedCostCenter] = useState<string>('');
  const [filtersInitialized, setFiltersInitialized] = useState(false);
  const [categoryPresets, setCategoryPresets] = useState<CategoryPreset[]>([]);
  const [activeCategoryPresetId, setActiveCategoryPresetId] = useState<string>('');
  const [categoryPresetName, setCategoryPresetName] = useState<string>('');
  const [categoryStates, setCategoryStates] = useState<string[]>([]);
  const [categoryCostCenters, setCategoryCostCenters] = useState<string[]>([]);
  const [categoryChartType, setCategoryChartType] = useState<'bar' | 'donut'>('donut');
  const [layouts, setLayouts] = useState<Layouts>(() => createEmptyLayouts());
  const [dynamicWidgetHeights, setDynamicWidgetHeights] = useState<Record<string, { h: number; minH: number }>>({});
  const isCustomizing = customizeDialogOpen;

  const persistDashboardPreferences = async (
    statsToSave: string[] = selectedStats,
    presetsToSave: CategoryPreset[] = categoryPresets,
    layoutsToSave: Layouts = layouts,
  ): Promise<boolean> => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/dashboard-preferences/${userId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          enabledStatistics: statsToSave,
          categoryPresets: presetsToSave,
          widgetLayouts: layoutsToSave,
        }),
      });

      if (!response.ok) {
        throw new Error(`Failed to save preferences: ${response.status}`);
      }

      return true;
    } catch (error) {
      debugError('Error saving dashboard preferences:', error);
      return false;
    }
  };

  const handleCategoryStatesChange = (event: SelectChangeEvent<typeof categoryStates>) => {
    const {
      target: { value },
    } = event;
    const nextStates = typeof value === 'string' ? value.split(',') : value;

    if (nextStates.includes(CATEGORY_ALL_STATES_VALUE)) {
      setCategoryStates([]);
    } else {
      setCategoryStates(nextStates);
    }
  };

  const handleCategoryCostCentersChange = (event: SelectChangeEvent<typeof categoryCostCenters>) => {
    const {
      target: { value },
    } = event;
    const nextCostCenters = typeof value === 'string' ? value.split(',') : value;

    if (nextCostCenters.includes(CATEGORY_ALL_COST_CENTERS_VALUE)) {
      setCategoryCostCenters([]);
    } else {
      setCategoryCostCenters(nextCostCenters);
    }
  };

  const handleCategoryChartTypeChange = (
    _event: React.MouseEvent<HTMLElement>,
    newType: 'bar' | 'donut' | null,
  ) => {
    if (!newType) return;
    setCategoryChartType(newType);
  };

  const handleSelectCategoryPreset = (event: SelectChangeEvent<string>) => {
    const presetId = event.target.value;
    if (!presetId) {
      setActiveCategoryPresetId('');
      setCategoryPresetName('');
      return;
    }

    const preset = categoryPresets.find(p => p.id === presetId);
    if (!preset) return;

    setCategoryStates(preset.states || []);
    setCategoryCostCenters(preset.costCenters || []);
    setCategoryChartType(preset.chartType || 'donut');
    setActiveCategoryPresetId(presetId);
    setCategoryPresetName(preset.name || '');
  };

  const handleSaveExistingCategoryPreset = async () => {
    if (!activeCategoryPresetId) {
      alert('Select a preset to update.');
      return;
    }

    const trimmedName = categoryPresetName.trim();
    if (!trimmedName) {
      alert('Enter a preset name before saving.');
      return;
    }

    const existingIndex = categoryPresets.findIndex(preset => preset.id === activeCategoryPresetId);
    if (existingIndex === -1) {
      alert('Unable to find selected preset.');
      return;
    }

    const duplicateName = categoryPresets.find(
      preset =>
        preset.id !== activeCategoryPresetId && preset.name.toLowerCase() === trimmedName.toLowerCase(),
    );
    if (duplicateName) {
      alert('A preset with that name already exists. Choose a different name.');
      return;
    }

    const updatedPreset: CategoryPreset = {
      ...categoryPresets[existingIndex],
      name: trimmedName,
      states: [...categoryStates],
      costCenters: [...categoryCostCenters],
      chartType: categoryChartType,
    };

    const updatedPresets = categoryPresets.map((preset, index) =>
      index === existingIndex ? updatedPreset : preset
    );

    const success = await persistDashboardPreferences(selectedStats, updatedPresets, layouts);
    if (!success) {
      alert('Failed to save preset. Please try again.');
      return;
    }

    setCategoryPresets(updatedPresets);
    setCategoryPresetName(trimmedName);
  };

  const handleSaveNewCategoryPreset = async () => {
    const trimmedName = categoryPresetName.trim();
    if (!trimmedName) {
      alert('Enter a preset name before saving.');
      return;
    }

    const duplicateName = categoryPresets.find(
      preset => preset.name.toLowerCase() === trimmedName.toLowerCase(),
    );
    if (duplicateName) {
      alert('A preset with that name already exists. Choose a different name or use Save.');
      return;
    }

    const newPreset: CategoryPreset = {
      id: `catpreset-${Date.now()}-${Math.random().toString(36).slice(2)}`,
      name: trimmedName,
      states: [...categoryStates],
      costCenters: [...categoryCostCenters],
      chartType: categoryChartType,
    };

    const updatedPresets = [...categoryPresets, newPreset];
    const success = await persistDashboardPreferences(selectedStats, updatedPresets, layouts);
    if (!success) {
      alert('Failed to save preset. Please try again.');
      return;
    }

    setCategoryPresets(updatedPresets);
    setActiveCategoryPresetId(newPreset.id);
    setCategoryPresetName(trimmedName);
  };

  const handleDeleteCategoryPreset = async () => {
    if (!activeCategoryPresetId) {
      return;
    }

    const presetToDelete = categoryPresets.find(preset => preset.id === activeCategoryPresetId);
    if (!presetToDelete) {
      return;
    }

    const confirmed = window.confirm(`Delete preset "${presetToDelete.name}"?`);
    if (!confirmed) {
      return;
    }

    const updatedPresets = categoryPresets.filter(preset => preset.id !== activeCategoryPresetId);
    const success = await persistDashboardPreferences(selectedStats, updatedPresets, layouts);
    if (!success) {
      alert('Failed to delete preset. Please try again.');
      return;
    }

    setCategoryPresets(updatedPresets);
    setActiveCategoryPresetId('');
    setCategoryPresetName('');
  };

  const handleLayoutChange = (_currentLayout: Layout[], allLayouts: Layouts) => {
    if (!customizeDialogOpen) return;
    setLayouts(ensureLayoutsForStats(selectedStats, allLayouts));
  };

  const loadUserPreferences = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/dashboard-preferences/${userId}`);
      if (response.ok) {
        const data = await response.json();
        const statsFromPrefs: string[] = Array.isArray(data.enabledStatistics) && data.enabledStatistics.length > 0
          ? data.enabledStatistics
          : getDefaultStatistics();

        const loadedLayoutsRaw = data.widgetLayouts && typeof data.widgetLayouts === 'object'
          ? (data.widgetLayouts as Partial<Layouts>)
          : undefined;

        const normalizedLayouts = ensureLayoutsForStats(statsFromPrefs, loadedLayoutsRaw);

        const loadedPresets: CategoryPreset[] = Array.isArray(data.categoryPresets)
          ? data.categoryPresets
              .map((preset: any): CategoryPreset | null => {
                if (!preset || typeof preset !== 'object') return null;
                const id = typeof preset.id === 'string' && preset.id.trim()
                  ? preset.id.trim()
                  : `catpreset-${Date.now()}-${Math.random().toString(36).slice(2)}`;
                const name = typeof preset.name === 'string' && preset.name.trim()
                  ? preset.name.trim()
                  : 'Preset';
                const states = Array.isArray(preset.states)
                  ? preset.states.filter((state: unknown): state is string => typeof state === 'string')
                  : [];
                const costCenters = Array.isArray(preset.costCenters)
                  ? preset.costCenters.filter((cc: unknown): cc is string => typeof cc === 'string')
                  : [];
                const chartType: 'bar' | 'donut' = preset.chartType === 'bar' ? 'bar' : 'donut';

                return { id, name, states, costCenters, chartType };
              })
              .filter((preset: CategoryPreset | null): preset is CategoryPreset => preset !== null)
          : [];

        setCategoryPresets(loadedPresets);
        setActiveCategoryPresetId('');
        setCategoryPresetName('');
        setLayouts(normalizedLayouts);
        setSelectedStats(statsFromPrefs);
      } else {
        const defaults = getDefaultStatistics();
        setSelectedStats(defaults);
        setCategoryPresets([]);
        setActiveCategoryPresetId('');
        setCategoryPresetName('');
        setLayouts(ensureLayoutsForStats(defaults));
      }
    } catch (error) {
      debugError('Error loading preferences:', error);
      const defaults = getDefaultStatistics();
      setSelectedStats(defaults);
      setCategoryPresets([]);
      setActiveCategoryPresetId('');
      setCategoryPresetName('');
      setLayouts(ensureLayoutsForStats(defaults));
    }

    // Filter available statistics based on user role
    const filtered = AVAILABLE_STATISTICS.filter(stat => stat.availableFor.includes(userRole));
    setAvailableStats(filtered);
  };

  const getDefaultStatistics = (): string[] => {
    const defaults: Record<string, string[]> = {
      finance: ['expenses-trend', 'total-expenses', 'pending-reports', 'approved-reports', 'total-receipts', 'total-miles'],
      supervisor: ['expenses-trend', 'pending-reports', 'team-members', 'total-expenses', 'submissions-this-month'],
      admin: ['expenses-trend', 'total-expenses', 'total-employees', 'pending-reports', 'total-receipts'],
    };
    return defaults[userRole] || defaults.finance;
  };

  const loadStatistics = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (dateRange) {
        params.append('startDate', dateRange.start.toISOString());
        params.append('endDate', dateRange.end.toISOString());
      }
      params.append('statistics', selectedStats.join(','));
      
      // Add filter parameters only if a value is selected (not empty string)
      if (selectedState && selectedState.trim() !== '') {
        params.append('filterState', selectedState);
      }
      if (selectedCostCenter && selectedCostCenter.trim() !== '') {
        params.append('filterCostCenter', selectedCostCenter);
      }
      if (selectedStats.includes('expenses-by-category')) {
        if (categoryStates.length > 0) {
          params.append('filterStates', categoryStates.join(','));
        }
        if (categoryCostCenters.length > 0) {
          params.append('filterCostCenters', categoryCostCenters.join(','));
        }
      }

      const response = await fetch(`${API_BASE_URL}/api/dashboard-statistics?${params.toString()}`, {
        headers: {
          'X-User-Role': userRole,
          'X-User-Id': userId,
        },
      });

      if (!response.ok) throw new Error('Failed to load statistics');

      const data = await response.json();
      const stats: Statistic[] = data.statistics.map((stat: any) => ({
        id: stat.id,
        title: stat.title,
        value: stat.value,
        icon: getIcon(stat.icon),
        color: stat.color || '#1976d2',
        trend: stat.trend,
        subtitle: stat.subtitle,
        metadata: stat.metadata,
      }));

      setStatistics(stats);
      const heightOverrides = determineWidgetHeights(stats);
      setDynamicWidgetHeights(heightOverrides);
      setLayouts((prev) => applyWidgetHeights(prev, heightOverrides));
      
      // Initialize selected filters from metadata only on first load
      if (!filtersInitialized) {
        const stateStat = stats.find(s => s.id === 'expenses-by-state');
        const costCenterStat = stats.find(s => s.id === 'expenses-by-cost-center');
        const categoryStat = stats.find(s => s.id === 'expenses-by-category');
        
        if (stateStat?.metadata?.selectedState) {
          setSelectedState(stateStat.metadata.selectedState);
        }
        if (costCenterStat?.metadata?.selectedCostCenter) {
          setSelectedCostCenter(costCenterStat.metadata.selectedCostCenter);
        }
        if (categoryStat?.metadata?.selectedStates) {
          setCategoryStates(categoryStat.metadata.selectedStates);
        }
        if (categoryStat?.metadata?.selectedCostCenters) {
          setCategoryCostCenters(categoryStat.metadata.selectedCostCenters);
        }
        setFiltersInitialized(true);
        setCategoryPresetName(activeCategoryPresetId ? categoryPresetName : '');
      } else {
        const categoryStat = stats.find(s => s.id === 'expenses-by-category');
        if (categoryStat?.metadata?.selectedStates) {
          const newStates = categoryStat.metadata.selectedStates;
          setCategoryStates(prev => {
            const prevKey = [...prev].sort().join('|');
            const newKey = [...newStates].sort().join('|');
            return prevKey === newKey ? prev : newStates;
          });
        }
        if (categoryStat?.metadata?.selectedCostCenters) {
          const newCostCenters = categoryStat.metadata.selectedCostCenters;
          setCategoryCostCenters(prev => {
            const prevKey = [...prev].sort().join('|');
            const newKey = [...newCostCenters].sort().join('|');
            return prevKey === newKey ? prev : newCostCenters;
          });
        }
        if (activeCategoryPresetId) {
          const activePreset = categoryPresets.find(preset => preset.id === activeCategoryPresetId);
          if (activePreset) {
            setCategoryPresetName(activePreset.name);
          }
        }
      }
    } catch (error) {
      debugError('Error loading statistics:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const initialize = async () => {
      await loadUserPreferences();
    };
    initialize();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, userRole]);

  useEffect(() => {
    if (selectedStats.length > 0) {
      loadStatistics();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedStats, dateRange, selectedState, selectedCostCenter, categoryStates, categoryCostCenters]);

  useEffect(() => {
    setLayouts((prevLayouts: Layouts) => ensureLayoutsForStats(selectedStats, prevLayouts));
  }, [selectedStats]);

  useEffect(() => {
    if (Object.keys(dynamicWidgetHeights).length === 0) return;
    setLayouts((prev) => applyWidgetHeights(prev, dynamicWidgetHeights));
  }, [dynamicWidgetHeights]);

  useEffect(() => {
    if (!activeCategoryPresetId) {
      setCategoryPresetName('');
      return;
    }
    const preset = categoryPresets.find((p) => p.id === activeCategoryPresetId);
    setCategoryPresetName(preset ? preset.name : '');
  }, [activeCategoryPresetId, categoryPresets]);

  const handleSavePreferences = async () => {
    const success = await persistDashboardPreferences(selectedStats, categoryPresets, layouts);
    if (!success) {
      alert('Failed to save preferences');
      return;
    }

    setCustomizeDialogOpen(false);
    loadStatistics();
  };

  const handleToggleStatistic = (statId: string) => {
    setSelectedStats(prev =>
      prev.includes(statId)
        ? prev.filter(id => id !== statId)
        : [...prev, statId]
    );
  };

  if (loading && statistics.length === 0) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
        <Typography variant="h6">Dashboard Statistics</Typography>
        <Tooltip title="Customize Dashboard">
          <IconButton size="small" onClick={() => setCustomizeDialogOpen(true)}>
            <SettingsIcon />
          </IconButton>
        </Tooltip>
      </Box>

      {isCustomizing && (
        <Typography variant="body2" color="textSecondary" sx={{ mb: 2 }}>
          Drag cards to reorder them, then click Save Preferences to store the layout.
        </Typography>
      )}

      <ResponsiveGridLayout
        className={`dashboard-grid ${isCustomizing ? 'dashboard-grid--customizing' : ''}`}
        layouts={layouts}
        breakpoints={GRID_BREAKPOINTS}
        cols={GRID_COLUMNS}
        rowHeight={120}
        margin={[16, 16]}
        isDraggable={isCustomizing}
        isResizable={false}
        compactType="vertical"
        preventCollision={!isCustomizing}
        onLayoutChange={handleLayoutChange}
      >
        {statistics.map((stat) => {
          const isStateStat = stat.id === 'expenses-by-state';
          const isCostCenterStat = stat.id === 'expenses-by-cost-center';
          const isCategoryStat = stat.id === 'expenses-by-category';
          const stateOptions = stat.metadata?.availableStates || [];
          const costCenterOptions = stat.metadata?.availableCostCenters || [];
          const trendData = stat.metadata?.trendData || [];
          const isTrendStat = trendData.length > 0;
          const categoryData = stat.metadata?.categories || [];
          const hasCategoryData = categoryData.length > 0;
          const formatValue = (value: number) => stat.metadata?.trendUnit === 'currency'
            ? `$${value.toLocaleString()}`
            : value.toLocaleString();

          return (
            <div key={stat.id}>
              <Card
                sx={{
                  height: '100%',
                  display: 'flex',
                  flexDirection: 'column',
                }}
              >
                <CardContent sx={{ display: 'flex', flexDirection: 'column', height: '100%', p: 2 }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 1 }}>
                  <Box sx={{ color: stat.color, display: 'flex', alignItems: 'center' }}>
                    {stat.icon}
                  </Box>
                  {stat.trend && (
                    <Chip
                      icon={stat.trend.value >= 0 ? <TrendingUp /> : <TrendingDown />}
                      label={stat.trend.label}
                      size="small"
                      color={stat.trend.value >= 0 ? 'success' : 'error'}
                      sx={{ height: 20 }}
                    />
                  )}
                </Box>
                
                {/* Dropdown for State filter */}
                {isStateStat && (
                  <FormControl fullWidth size="small" sx={{ mb: 1 }}>
                    <InputLabel>Select State</InputLabel>
                    <Select
                      value={selectedState || ''}
                      label="Select State"
                      onChange={(e) => setSelectedState(e.target.value)}
                      disabled={stateOptions.length === 0}
                    >
                      <MenuItem value="">
                        <em>All States</em>
                      </MenuItem>
                      {stateOptions.length > 0 ? (
                        stateOptions.map((state) => (
                          <MenuItem key={state} value={state}>
                            {state}
                          </MenuItem>
                        ))
                      ) : (
                        <MenuItem value="" disabled>
                          No states available
                        </MenuItem>
                      )}
                    </Select>
                  </FormControl>
                )}
                
                {/* Dropdown for Cost Center filter */}
                {isCostCenterStat && costCenterOptions.length > 0 && (
                  <FormControl fullWidth size="small" sx={{ mb: 1 }}>
                    <InputLabel>Select Cost Center</InputLabel>
                    <Select
                      value={selectedCostCenter || ''}
                      label="Select Cost Center"
                      onChange={(e) => setSelectedCostCenter(e.target.value)}
                    >
                      <MenuItem value="">
                        <em>All Cost Centers</em>
                      </MenuItem>
                      {costCenterOptions.map((cc) => (
                        <MenuItem key={cc} value={cc}>
                          {cc}
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                )}
                
                {/* Category filters and chart type */}
                {isCategoryStat && (
                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1, mb: hasCategoryData ? 1 : 0 }}>
                    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, alignItems: 'center' }}>
                      <FormControl size="small" sx={{ minWidth: 160 }}>
                        <InputLabel>Preset</InputLabel>
                        <Select
                          value={activeCategoryPresetId}
                          label="Preset"
                          onChange={handleSelectCategoryPreset}
                        >
                          <MenuItem value="">
                            <em>None</em>
                          </MenuItem>
                          {categoryPresets.map((preset) => (
                            <MenuItem key={preset.id} value={preset.id}>
                              {preset.name}
                            </MenuItem>
                          ))}
                        </Select>
                      </FormControl>
                      <TextField
                        size="small"
                        label="Preset Name"
                        value={categoryPresetName}
                        onChange={(event) => setCategoryPresetName(event.target.value)}
                        sx={{ minWidth: 200 }}
                      />
                      <Button
                        size="small"
                        variant="outlined"
                        startIcon={<Save fontSize="small" />}
                        onClick={handleSaveNewCategoryPreset}
                        disabled={categoryPresetName.trim().length === 0}
                      >
                        Save New
                      </Button>
                      <Button
                        size="small"
                        variant="contained"
                        startIcon={<Save fontSize="small" />}
                        onClick={handleSaveExistingCategoryPreset}
                        disabled={!activeCategoryPresetId || categoryPresetName.trim().length === 0}
                      >
                        Save
                      </Button>
                      <Button
                        size="small"
                        color="error"
                        variant="text"
                        startIcon={<DeleteOutline fontSize="small" />}
                        onClick={handleDeleteCategoryPreset}
                        disabled={!activeCategoryPresetId}
                      >
                        Delete
                      </Button>
                    </Box>
                    <FormControl fullWidth size="small">
                      <InputLabel>States</InputLabel>
                      <Select
                        multiple
                        value={categoryStates}
                        label="States"
                        onChange={handleCategoryStatesChange}
                        renderValue={(selected) => selected.length === 0 ? 'All States' : selected.join(', ')}
                        MenuProps={CATEGORY_MENU_PROPS}
                        disabled={stateOptions.length === 0}
                      >
                        <MenuItem value={CATEGORY_ALL_STATES_VALUE}>
                          <em>All States</em>
                        </MenuItem>
                        {stateOptions.map((state) => (
                          <MenuItem key={state} value={state}>
                            {state}
                          </MenuItem>
                        ))}
                      </Select>
                    </FormControl>
                    <FormControl fullWidth size="small">
                      <InputLabel>Cost Centers</InputLabel>
                      <Select
                        multiple
                        value={categoryCostCenters}
                        label="Cost Centers"
                        onChange={handleCategoryCostCentersChange}
                        renderValue={(selected) => selected.length === 0 ? 'All Cost Centers' : selected.join(', ')}
                        MenuProps={CATEGORY_MENU_PROPS}
                        disabled={costCenterOptions.length === 0}
                      >
                        <MenuItem value={CATEGORY_ALL_COST_CENTERS_VALUE}>
                          <em>All Cost Centers</em>
                        </MenuItem>
                        {costCenterOptions.map((cc) => (
                          <MenuItem key={cc} value={cc}>
                            {cc}
                          </MenuItem>
                        ))}
                      </Select>
                    </FormControl>
                    <ToggleButtonGroup
                      value={categoryChartType}
                      exclusive
                      onChange={handleCategoryChartTypeChange}
                      size="small"
                      sx={{ alignSelf: 'flex-start' }}
                    >
                      <ToggleButton value="bar">Bar</ToggleButton>
                      <ToggleButton value="donut">
                        <DonutLarge sx={{ fontSize: 18, mr: 0.5 }} /> Donut
                      </ToggleButton>
                    </ToggleButtonGroup>
                  </Box>
                )}

                <Typography variant="h4" sx={{ fontWeight: 'bold', mb: 0.5 }}>
                  {typeof stat.value === 'number' && stat.value >= 1000
                    ? `$${(stat.value / 1000).toFixed(1)}k`
                    : typeof stat.value === 'number' && stat.value < 0
                    ? `-$${Math.abs(stat.value).toLocaleString()}`
                    : typeof stat.value === 'number'
                    ? `$${stat.value.toLocaleString()}`
                    : stat.value}
                </Typography>
                <Typography variant="body2" color="textSecondary">
                  {stat.title}
                </Typography>
                {stat.subtitle && (
                  <Typography variant="caption" color="textSecondary" sx={{ mt: 0.5, display: 'block' }}>
                    {stat.subtitle}
                  </Typography>
                )}
                {isTrendStat && (
                  <Box sx={{ mt: 2, flexGrow: 1 }}>
                    <ResponsiveContainer width="100%" height={160}>
                      <AreaChart data={trendData}>
                        <defs>
                          <linearGradient id={`trendGradient-${stat.id}`} x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor={stat.color} stopOpacity={0.45} />
                            <stop offset="95%" stopColor={stat.color} stopOpacity={0.05} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e0e0e0" />
                        <XAxis dataKey="label" stroke="#9e9e9e" />
                        <YAxis hide domain={['auto', 'auto']} />
                        <RechartsTooltip
                          content={({ active, payload, label }) => {
                            if (!active || !payload || payload.length === 0) return null;
                            const value = payload[0].value as number;
                            const formattedValue = stat.metadata?.trendUnit === 'currency'
                              ? `$${value.toLocaleString()}`
                              : value.toLocaleString();
                            return (
                              <Box sx={{ bgcolor: 'background.paper', boxShadow: 3, p: 1.5, borderRadius: 1 }}>
                                <Typography variant="caption" color="textSecondary">
                                  {label}
                                </Typography>
                                <Typography variant="body2" sx={{ fontWeight: 600 }}>
                                  {formattedValue}
                                </Typography>
                              </Box>
                            );
                          }}
                        />
                        <Area
                          type="monotone"
                          dataKey="value"
                          stroke={stat.color}
                          fill={`url(#trendGradient-${stat.id})`}
                          strokeWidth={2}
                          dot={{ r: 3 }}
                          activeDot={{ r: 5 }}
                        />
                      </AreaChart>
                    </ResponsiveContainer>
                  </Box>
                )}
                {isCategoryStat && (
                  <Box sx={{ mt: 2, flexGrow: 1, width: '100%' }}>
                    {hasCategoryData ? (
                      <ResponsiveContainer width="100%" height={240}>
                        {categoryChartType === 'donut' ? (
                          <PieChart>
                            <RechartsTooltip
                              content={({ active, payload, label }) => {
                                if (!active || !payload || payload.length === 0) return null;
                                const value = payload[0].value as number;
                                return (
                                  <Box sx={{ bgcolor: 'background.paper', boxShadow: 3, p: 1.5, borderRadius: 1 }}>
                                    <Typography variant="caption" color="textSecondary">
                                      {label}
                                    </Typography>
                                    <Typography variant="body2" sx={{ fontWeight: 600 }}>
                                      {formatValue(value)}
                                    </Typography>
                                  </Box>
                                );
                              }}
                            />
                            <Pie
                              data={categoryData}
                              dataKey="value"
                              nameKey="label"
                              innerRadius={55}
                              outerRadius={80}
                              paddingAngle={3}
                            >
                              {categoryData.map((entry, index) => (
                                <Cell key={`cat-${entry.id}`} fill={CATEGORY_COLORS[index % CATEGORY_COLORS.length]} />
                              ))}
                            </Pie>
                          </PieChart>
                        ) : (
                          <BarChart data={categoryData}>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e0e0e0" />
                            <XAxis dataKey="label" stroke="#9e9e9e" angle={-15} textAnchor="end" height={50} interval={0} />
                            <YAxis stroke="#9e9e9e" />
                            <RechartsTooltip
                              content={({ active, payload, label }) => {
                                if (!active || !payload || payload.length === 0) return null;
                                const value = payload[0].value as number;
                                return (
                                  <Box sx={{ bgcolor: 'background.paper', boxShadow: 3, p: 1.5, borderRadius: 1 }}>
                                    <Typography variant="caption" color="textSecondary">
                                      {label}
                                    </Typography>
                                    <Typography variant="body2" sx={{ fontWeight: 600 }}>
                                      {formatValue(value)}
                                    </Typography>
                                  </Box>
                                );
                              }}
                            />
                            <Bar dataKey="value" fill={stat.color} radius={[6, 6, 0, 0]} />
                          </BarChart>
                        )}
                      </ResponsiveContainer>
                    ) : (
                      <Typography variant="caption" color="textSecondary">
                        No category data available for the selected filters.
                      </Typography>
                    )}
                  </Box>
                )}
              </CardContent>
            </Card>
            </div>
          );
        })}
      </ResponsiveGridLayout>

      <Drawer
        variant="persistent"
        anchor="right"
        open={customizeDialogOpen}
        onClose={() => setCustomizeDialogOpen(false)}
        PaperProps={{ sx: { width: 360, p: 3, maxWidth: '100%' } }}
      >
        <Typography variant="h6" sx={{ mb: 1 }}>
          Customize Dashboard
        </Typography>
        <Typography variant="body2" color="textSecondary" sx={{ mb: 2 }}>
          Choose which widgets to show. Drag and resize cards on the dashboard to adjust layout.
        </Typography>
        <Divider sx={{ mb: 2 }} />
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1, flexGrow: 1 }}>
          {availableStats.map((stat) => (
            <FormControlLabel
              key={stat.id}
              control={
                <Checkbox
                  checked={selectedStats.includes(stat.id)}
                  onChange={() => handleToggleStatistic(stat.id)}
                />
              }
              label={
                <Box>
                  <Typography variant="body1">{stat.title}</Typography>
                  <Typography variant="caption" color="textSecondary">
                    {stat.description}
                  </Typography>
                </Box>
              }
            />
          ))}
        </Box>
        <Divider sx={{ my: 2 }} />
        <Box sx={{ display: 'flex', justifyContent: 'space-between', gap: 1 }}>
          <Button onClick={() => setCustomizeDialogOpen(false)}>Close</Button>
          <Button onClick={handleSavePreferences} variant="contained">
            Save Preferences
          </Button>
        </Box>
      </Drawer>
    </Box>
  );
};

