import React, { useRef } from 'react';
import { Button, Box, Typography } from '@mui/material';
import {
  CloudUpload as UploadIcon,
  CloudDownload as SavedIcon,
} from '@mui/icons-material';

export interface SignatureUploadPanelProps {
  currentSignature: string | null;
  savedSignature: string | null;
  onApplySaved: () => void | Promise<void>;
  onUploadNew: (file: File) => void | Promise<void>;
  onRemove?: () => void | Promise<void>;
  savedButtonLabel?: string;
  newButtonLabel?: string;
}

export const SignatureUploadPanel: React.FC<SignatureUploadPanelProps> = ({
  currentSignature,
  savedSignature,
  onApplySaved,
  onUploadNew,
  onRemove,
  savedButtonLabel = 'Upload saved',
  newButtonLabel = 'Upload new',
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      await onUploadNew(file);
    } catch (err) {
      if (err instanceof Error && err.message === 'PNG_REQUIRED') {
        window.alert('Please upload a PNG file only.');
      } else {
        window.alert(err instanceof Error ? err.message : 'Failed to upload signature');
      }
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      <Typography variant="body2" color="text.secondary">
        Choose a saved signature from your profile or upload a new PNG file. New uploads are saved to your account for future reports.
      </Typography>

      {currentSignature && (
        <Box sx={{ textAlign: 'center' }}>
          <Typography variant="subtitle2" gutterBottom>
            Signature on this report
          </Typography>
          <Box
            sx={{
              border: '1px solid',
              borderColor: 'divider',
              borderRadius: 1,
              p: 2,
              bgcolor: 'background.paper',
              display: 'inline-block',
            }}
          >
            <img
              src={currentSignature}
              alt="Current signature"
              style={{ maxHeight: 100, maxWidth: 200, objectFit: 'contain' }}
            />
          </Box>
        </Box>
      )}

      <Button
        variant="outlined"
        startIcon={<SavedIcon />}
        onClick={() => void onApplySaved()}
        disabled={!savedSignature}
        fullWidth
      >
        {savedButtonLabel}
      </Button>

      <input
        ref={fileInputRef}
        type="file"
        accept=".png"
        onChange={(e) => void handleFileChange(e)}
        style={{ display: 'none' }}
      />
      <Button
        variant="outlined"
        startIcon={<UploadIcon />}
        onClick={() => fileInputRef.current?.click()}
        fullWidth
      >
        {newButtonLabel}
      </Button>

      {currentSignature && onRemove && (
        <Button variant="text" color="error" onClick={() => void onRemove()} fullWidth>
          Remove signature from this report
        </Button>
      )}

      <Typography variant="caption" color="text.secondary" component="div">
        Use a PNG with a transparent or white background. Recommended size: about 200×100 pixels.
      </Typography>
    </Box>
  );
};

export default SignatureUploadPanel;
