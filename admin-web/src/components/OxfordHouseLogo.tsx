import React from 'react';
import { Box } from '@mui/material';

interface OxfordHouseLogoProps {
  size?: number;
  className?: string;
}

const OxfordHouseLogo: React.FC<OxfordHouseLogoProps> = ({ size = 56, className }) => {
  return (
    <Box
      className={className}
      sx={{
        width: size,
        height: size,
        position: 'relative',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <svg
        width={size}
        height={size}
        viewBox="0 0 100 100"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        {/* Green O - outer circle */}
        <circle
          cx="50"
          cy="50"
          r="45"
          fill="#4CAF50"
          stroke="none"
        />
        
        {/* Blue H with integrated house */}
        <g>
          {/* Left vertical bar of H */}
          <rect
            x="25"
            y="20"
            width="8"
            height="50"
            fill="#2196F3"
          />
          
          {/* Right vertical bar of H */}
          <rect
            x="67"
            y="20"
            width="8"
            height="50"
            fill="#2196F3"
          />
          
          {/* Horizontal bar of H */}
          <rect
            x="25"
            y="40"
            width="50"
            height="8"
            fill="#2196F3"
          />
          
          {/* House roof (triangle) */}
          <polygon
            points="25,48 50,35 75,48"
            fill="#2196F3"
          />
          
          {/* House base (rectangle) */}
          <rect
            x="30"
            y="48"
            width="40"
            height="22"
            fill="#2196F3"
          />
          
          {/* House door */}
          <rect
            x="45"
            y="58"
            width="10"
            height="12"
            fill="#1976D2"
          />
        </g>
      </svg>
    </Box>
  );
};

export default OxfordHouseLogo;
