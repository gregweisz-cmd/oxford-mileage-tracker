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
        
        {/* Blue H with integrated house - matching original design */}
        <g>
          {/* Left vertical bar of H */}
          <rect
            x="22"
            y="15"
            width="10"
            height="60"
            fill="#2196F3"
          />
          
          {/* Right vertical bar of H */}
          <rect
            x="68"
            y="15"
            width="10"
            height="60"
            fill="#2196F3"
          />
          
          {/* Horizontal bar of H */}
          <rect
            x="22"
            y="40"
            width="56"
            height="10"
            fill="#2196F3"
          />
          
          {/* House roof (triangle) - integrated into H */}
          <polygon
            points="22,50 50,30 78,50"
            fill="#2196F3"
          />
          
          {/* House base (rectangle) - bottom part of H */}
          <rect
            x="27"
            y="50"
            width="46"
            height="25"
            fill="#2196F3"
          />
          
          {/* House door */}
          <rect
            x="45"
            y="60"
            width="10"
            height="15"
            fill="#1976D2"
          />
        </g>
      </svg>
    </Box>
  );
};

export default OxfordHouseLogo;
