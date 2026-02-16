import React, { createContext, useContext, useState, useCallback, ReactNode } from 'react';
import { Dialog, DialogTitle, DialogContent, DialogContentText, DialogActions, Button } from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';

export interface ErrorPromptOptions {
  /** Callback when user clicks "Go back" (e.g. close modal, switch view). If not set, button still closes the dialog. */
  onGoBack?: () => void;
  /** Button label. Default: "Go back" */
  goBackLabel?: string;
  /** Optional title. Default: "Something went wrong" */
  title?: string;
}

interface ErrorPromptContextType {
  /** Show an error dialog with a "Go back" button so the user can return to the previous page/view. */
  showErrorPrompt: (message: string, options?: ErrorPromptOptions) => void;
}

const ErrorPromptContext = createContext<ErrorPromptContextType | undefined>(undefined);

export const ErrorPromptProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState('');
  const [title, setTitle] = useState('Something went wrong');
  const [goBackLabel, setGoBackLabel] = useState('Go back');
  const [onGoBack, setOnGoBack] = useState<(() => void) | undefined>(undefined);

  const showErrorPrompt = useCallback((msg: string, options?: ErrorPromptOptions) => {
    setMessage(msg);
    setTitle(options?.title ?? 'Something went wrong');
    setGoBackLabel(options?.goBackLabel ?? 'Go back');
    setOnGoBack(options?.onGoBack ?? undefined);
    setOpen(true);
  }, []);

  const handleGoBack = useCallback(() => {
    setOpen(false);
    if (onGoBack) {
      onGoBack();
    }
  }, [onGoBack]);

  const handleClose = useCallback(() => {
    setOpen(false);
  }, []);

  return (
    <ErrorPromptContext.Provider value={{ showErrorPrompt }}>
      {children}
      <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth>
        <DialogTitle>{title}</DialogTitle>
        <DialogContent>
          <DialogContentText>{message}</DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleClose} color="primary">
            OK
          </Button>
          <Button
            variant="contained"
            onClick={handleGoBack}
            startIcon={<ArrowBackIcon />}
            color="primary"
          >
            {goBackLabel}
          </Button>
        </DialogActions>
      </Dialog>
    </ErrorPromptContext.Provider>
  );
};

export function useErrorPrompt(): ErrorPromptContextType {
  const ctx = useContext(ErrorPromptContext);
  if (ctx === undefined) {
    throw new Error('useErrorPrompt must be used within ErrorPromptProvider');
  }
  return ctx;
}

/**
 * Returns a friendly message and whether this looks like a 403/404 (so callers can show error prompt with "Go back").
 */
export function isHttpClientError(error: unknown): boolean {
  if (error instanceof Error) {
    const msg = error.message || '';
    return msg.includes('403') || msg.includes('404') || msg.includes('Forbidden') || msg.includes('Not Found');
  }
  return false;
}
