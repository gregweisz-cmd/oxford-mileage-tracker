import React from 'react';
import { Box, Button, CircularProgress, Typography } from '@mui/material';
import { Save as SaveIcon } from '@mui/icons-material';

export interface MileageOrderControlsProps {
  hasUnsavedMileageOrder: boolean;
  mileageOrderSaving: boolean;
  staffCanEditReport: boolean;
  onDiscard: () => void;
  onSave: () => void;
}

export default function MileageOrderControls({
  hasUnsavedMileageOrder,
  mileageOrderSaving,
  staffCanEditReport,
  onDiscard,
  onSave,
}: MileageOrderControlsProps) {
  if (!hasUnsavedMileageOrder) return null;

  return (
    <Box sx={{ display: 'flex', gap: 1, ml: 2, flexShrink: 0 }}>
      <Button
        variant="outlined"
        onClick={onDiscard}
        disabled={mileageOrderSaving || !staffCanEditReport}
      >
        Discard order
      </Button>
      <Button
        variant="contained"
        color="secondary"
        startIcon={mileageOrderSaving ? <CircularProgress size={18} color="inherit" /> : <SaveIcon />}
        onClick={onSave}
        disabled={mileageOrderSaving || !staffCanEditReport}
      >
        Save order
      </Button>
    </Box>
  );
}

export function MileageOrderHint({ hasUnsavedMileageOrder }: { hasUnsavedMileageOrder: boolean }) {
  return (
    <>
      <Typography variant="body2" color="textSecondary" sx={{ mt: 0.5 }}>
        Use the arrows to order trips within each day (first trip at the top), then click Save order when finished.
      </Typography>
      {hasUnsavedMileageOrder && (
        <Typography variant="body2" color="warning.main" sx={{ mt: 0.5, fontWeight: 600 }}>
          Unsaved trip order — save or discard before leaving this tab.
        </Typography>
      )}
    </>
  );
}
