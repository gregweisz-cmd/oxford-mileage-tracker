import { alpha, type Theme } from '@mui/material/styles';
import type { SxProps } from '@mui/material';

/** Bordered callout for red/error notes on report tabs. */
export const portalNoteBoxSx: SxProps<Theme> = (theme) => ({
  p: 2,
  border: '1px solid',
  borderColor: 'divider',
  borderRadius: 1,
  bgcolor:
    theme.palette.mode === 'dark'
      ? theme.palette.background.paper
      : theme.palette.grey[50],
});

/** Certification statement panel (employee / supervisor acknowledgment). */
export const portalCertificationBoxSx: SxProps<Theme> = (theme) => ({
  p: 2,
  border: '1px solid',
  borderColor: 'divider',
  borderRadius: 1,
  bgcolor:
    theme.palette.mode === 'dark'
      ? alpha(theme.palette.primary.main, 0.14)
      : '#fff0f5',
  color: 'text.primary',
});

/** Outer frame around each signature column on the cover sheet. */
export const portalSignatureFrameSx: SxProps<Theme> = {
  border: '1px solid',
  borderColor: 'divider',
  p: 2,
  borderRadius: 1,
};

/**
 * Inner pad where signature images render.
 * Stays light in dark mode so dark ink signatures remain readable.
 */
export const portalSignaturePadSx: SxProps<Theme> = (theme) => ({
  border: '1px solid',
  borderColor: 'divider',
  borderRadius: 1,
  bgcolor: theme.palette.mode === 'dark' ? '#e8eaed' : '#fff',
});

/** Supervisor revision / warning callout above the cover sheet. */
export const portalRevisionNoteSx: SxProps<Theme> = (theme) => ({
  p: 1.5,
  borderRadius: 1,
  border: '1px solid',
  borderColor:
    theme.palette.mode === 'dark'
      ? alpha(theme.palette.warning.main, 0.45)
      : 'warning.light',
  bgcolor:
    theme.palette.mode === 'dark'
      ? alpha(theme.palette.warning.main, 0.14)
      : 'warning.50',
  color: 'text.primary',
});

/** Neutral info panels (timesheet legends, section intros). */
export const portalInfoBoxSx: SxProps<Theme> = (theme) => ({
  p: 2,
  borderRadius: 1,
  bgcolor:
    theme.palette.mode === 'dark'
      ? theme.palette.background.paper
      : theme.palette.grey[50],
});

/** Edit overlay on signature pads — visible on light pad in dark mode. */
export const signatureEditButtonSx: SxProps<Theme> = (theme) => ({
  bgcolor: theme.palette.mode === 'dark' ? 'grey.200' : 'background.paper',
  '&:hover': {
    bgcolor: theme.palette.mode === 'dark' ? 'grey.300' : 'grey.100',
  },
});

/** Table cell borders that adapt to light/dark divider color. */
export const portalTableCellBorderSx = {
  border: '1px solid',
  borderColor: 'divider',
} as const;
