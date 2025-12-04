import React from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Typography,
  Box,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Divider,
} from '@mui/material';
import KeyboardIcon from '@mui/icons-material/Keyboard';
import { KeyboardShortcut, formatShortcut } from '../hooks/useKeyboardShortcuts';

interface KeyboardShortcutsDialogProps {
  open: boolean;
  onClose: () => void;
  shortcuts: KeyboardShortcut[];
  title?: string;
}

/**
 * Dialog component to display available keyboard shortcuts
 */
const KeyboardShortcutsDialog: React.FC<KeyboardShortcutsDialogProps> = ({
  open,
  onClose,
  shortcuts,
  title = 'Keyboard Shortcuts',
}) => {
  // Group shortcuts by category (if we add categories later)
  const activeShortcuts = shortcuts.filter((s) => !s.disabled);

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <KeyboardIcon />
          <Typography variant="h6">{title}</Typography>
        </Box>
      </DialogTitle>
      <DialogContent>
        <Typography variant="body2" color="text.secondary" paragraph>
          Use these keyboard shortcuts to navigate and perform actions quickly.
        </Typography>
        <Divider sx={{ my: 2 }} />
        <TableContainer component={Paper} variant="outlined">
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>
                  <Typography variant="subtitle2" fontWeight="bold">
                    Shortcut
                  </Typography>
                </TableCell>
                <TableCell>
                  <Typography variant="subtitle2" fontWeight="bold">
                    Action
                  </Typography>
                </TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {activeShortcuts.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={2} align="center">
                    <Typography variant="body2" color="text.secondary">
                      No shortcuts available
                    </Typography>
                  </TableCell>
                </TableRow>
              ) : (
                activeShortcuts.map((shortcut, index) => (
                  <TableRow key={index}>
                    <TableCell>
                      <Box
                        sx={{
                          display: 'inline-flex',
                          gap: 0.5,
                          flexWrap: 'wrap',
                          alignItems: 'center',
                        }}
                      >
                        {formatShortcut(shortcut)
                          .split(' + ')
                          .map((part, i) => (
                            <Box
                              key={i}
                              sx={{
                                padding: '2px 8px',
                                backgroundColor: 'grey.200',
                                borderRadius: 1,
                                fontFamily: 'monospace',
                                fontSize: '0.875rem',
                                fontWeight: 'medium',
                              }}
                            >
                              {part}
                            </Box>
                          ))}
                      </Box>
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2">{shortcut.description}</Typography>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </TableContainer>
        <Box sx={{ mt: 2 }}>
          <Typography variant="caption" color="text.secondary">
            Tip: Press <kbd>Ctrl</kbd> + <kbd>/</kbd> (or <kbd>⌘</kbd> + <kbd>/</kbd> on Mac) to
            open this dialog anytime.
          </Typography>
        </Box>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} variant="contained">
          Close
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default KeyboardShortcutsDialog;

