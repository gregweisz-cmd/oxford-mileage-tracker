/**
 * Dark portal palette — charcoal background with soft grey text (matches IDE/chat-style dark UI).
 */
export const darkPortalPalette = {
  background: {
    default: '#181818',
    paper: '#252526',
  },
  text: {
    primary: '#d4d4d4',
    secondary: '#9d9d9d',
  },
  divider: '#3c3c3c',
  action: {
    hover: 'rgba(255, 255, 255, 0.06)',
    selected: 'rgba(255, 255, 255, 0.10)',
  },
} as const;
