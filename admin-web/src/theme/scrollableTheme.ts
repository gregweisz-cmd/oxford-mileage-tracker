import type { Components, Theme } from '@mui/material/styles';

const scrollbarStyles = {
  scrollbarGutter: 'stable',
  overflowY: 'scroll',
  overflowX: 'auto',
} as const;

/** Dialogs, drawers, and modals always show scrollbars so validation/errors below the fold are discoverable. */
export const scrollableThemeComponents: Components<Theme> = {
  MuiDialogContent: {
    styleOverrides: {
      root: scrollbarStyles,
    },
  },
  MuiDrawer: {
    styleOverrides: {
      paper: scrollbarStyles,
    },
  },
};
