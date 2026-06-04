import React from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
} from '@mui/material';
import { SignatureUploadPanel, SignatureUploadPanelProps } from './SignatureUploadPanel';

export type SignatureUploadDialogProps = SignatureUploadPanelProps & {
  open: boolean;
  onClose: () => void;
  title?: string;
};

export const SignatureUploadDialog: React.FC<SignatureUploadDialogProps> = ({
  open,
  onClose,
  title = 'Upload Signature',
  ...panelProps
}) => (
  <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth>
    <DialogTitle>{title}</DialogTitle>
    <DialogContent>
      <SignatureUploadPanel {...panelProps} />
    </DialogContent>
    <DialogActions>
      <Button onClick={onClose}>Close</Button>
    </DialogActions>
  </Dialog>
);

export default SignatureUploadDialog;
