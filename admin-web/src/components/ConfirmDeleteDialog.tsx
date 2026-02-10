import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  Typography,
} from '@mui/material';

const REQUIRED_TEXT = 'CONFIRM';

export interface ConfirmDeleteDialogProps {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void | Promise<void>;
  title: string;
  message: string;
  requiredText?: string;
  confirmButtonLabel?: string;
  loading?: boolean;
}

/**
 * Dialog that requires the user to type CONFIRM (or custom requiredText) before the confirm action is enabled.
 */
export const ConfirmDeleteDialog: React.FC<ConfirmDeleteDialogProps> = ({
  open,
  onClose,
  onConfirm,
  title,
  message,
  requiredText = REQUIRED_TEXT,
  confirmButtonLabel = 'Delete',
  loading = false,
}) => {
  const [typed, setTyped] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!open) {
      setTyped('');
      setSubmitting(false);
    }
  }, [open]);

  const match = typed.trim().toUpperCase() === requiredText.toUpperCase();
  const handleConfirm = async () => {
    if (!match || submitting || loading) return;
    setSubmitting(true);
    try {
      await onConfirm();
      onClose();
    } catch (e) {
      // Caller may show error; keep dialog open
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>{title}</DialogTitle>
      <DialogContent>
        <Typography sx={{ mb: 2 }}>{message}</Typography>
        <TextField
          fullWidth
          size="small"
          label={`Type ${requiredText} to continue`}
          value={typed}
          onChange={(e) => setTyped(e.target.value)}
          autoComplete="off"
          disabled={loading || submitting}
          sx={{ mt: 1 }}
        />
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={loading || submitting}>
          Cancel
        </Button>
        <Button
          color="error"
          variant="contained"
          onClick={handleConfirm}
          disabled={!match || loading || submitting}
        >
          {loading || submitting ? 'Please wait...' : confirmButtonLabel}
        </Button>
      </DialogActions>
    </Dialog>
  );
};
