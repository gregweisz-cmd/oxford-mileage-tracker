import React, { useEffect, useMemo, useState } from 'react';
import { Box, List, ListItemButton, ListItemText, Paper, TextField, TextFieldProps } from '@mui/material';
import { WebAddressPrediction, WebGooglePlacesService } from '../services/googlePlacesService';
import { toCanonicalAddress } from '../utils/locationSelection';

interface GooglePlacesTextFieldProps extends Omit<TextFieldProps, 'onChange'> {
  value: string;
  onChange: (value: string) => void;
  onPlaceSelected?: (address: string) => void;
  minChars?: number;
}

const GooglePlacesTextField: React.FC<GooglePlacesTextFieldProps> = ({
  value,
  onChange,
  onPlaceSelected,
  minChars = 3,
  ...textFieldProps
}) => {
  const [predictions, setPredictions] = useState<WebAddressPrediction[]>([]);
  const [showPredictions, setShowPredictions] = useState(false);

  const enabled = useMemo(() => WebGooglePlacesService.isConfigured(), []);

  useEffect(() => {
    if (!enabled) {
      setPredictions([]);
      setShowPredictions(false);
      return;
    }

    const query = (value || '').trim();
    if (query.length < minChars) {
      setPredictions([]);
      setShowPredictions(false);
      return;
    }

    let active = true;
    const timeout = setTimeout(async () => {
      try {
        const results = await WebGooglePlacesService.getPredictions(query);
        if (!active) return;
        setPredictions(results);
        setShowPredictions(results.length > 0);
      } catch {
        if (!active) return;
        setPredictions([]);
        setShowPredictions(false);
      }
    }, 250);

    return () => {
      active = false;
      clearTimeout(timeout);
    };
  }, [enabled, minChars, value]);

  const handleSelectPrediction = async (prediction: WebAddressPrediction) => {
    setShowPredictions(false);
    setPredictions([]);

    const details = await WebGooglePlacesService.getDetails(prediction.placeId);
    const selectedAddress = toCanonicalAddress(details?.formattedAddress || prediction.description);
    onChange(selectedAddress);
    onPlaceSelected?.(selectedAddress);
  };

  return (
    <Box sx={{ position: 'relative' }}>
      <TextField
        {...textFieldProps}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onBlur={() => setTimeout(() => setShowPredictions(false), 150)}
        onFocus={() => setShowPredictions(predictions.length > 0)}
      />
      {enabled && showPredictions && predictions.length > 0 && (
        <Paper
          elevation={3}
          sx={{
            position: 'absolute',
            left: 0,
            right: 0,
            mt: 0.5,
            zIndex: 20,
            maxHeight: 240,
            overflowY: 'auto',
          }}
        >
          <List dense disablePadding>
            {predictions.map((prediction) => (
              <ListItemButton key={prediction.placeId} onMouseDown={() => handleSelectPrediction(prediction)}>
                <ListItemText primary={prediction.description} />
              </ListItemButton>
            ))}
          </List>
        </Paper>
      )}
    </Box>
  );
};

export default GooglePlacesTextField;
