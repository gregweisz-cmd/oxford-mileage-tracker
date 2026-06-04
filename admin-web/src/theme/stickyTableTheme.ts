import type { Components, Theme } from '@mui/material/styles';

const stickyHeadBg = (theme: Theme) =>
  theme.palette.mode === 'dark' ? theme.palette.grey[800] : theme.palette.grey[100];

/** App-wide sticky table headers (MuiTable stickyHeader + offset below portal chrome). */
export const stickyTableThemeComponents: Components<Theme> = {
  MuiTable: {
    defaultProps: {
      stickyHeader: true,
    },
  },
  MuiDialog: {
    styleOverrides: {
      paper: {
        '--app-sticky-offset': '0px',
      },
    },
  },
  MuiTableCell: {
    styleOverrides: {
      head: ({ theme }) => ({
        '&.MuiTableCell-stickyHeader': {
          top: 'var(--app-sticky-offset, 0px)',
          zIndex: theme.zIndex.appBar - 1,
          backgroundColor: stickyHeadBg(theme),
        },
      }),
    },
  },
};
