import React from 'react';
import { Box } from '@mui/material';

interface OxfordHouseLogoProps {
  size?: number;
  className?: string;
  showText?: boolean;
}

const OxfordHouseLogo: React.FC<OxfordHouseLogoProps> = ({ 
  size = 56, 
  className, 
  showText = false 
}) => {
  return (
    <Box
      className={className}
      sx={{
        display: 'flex',
        alignItems: 'center',
        gap: showText ? 2 : 0,
      }}
    >
      {/* Logo Image */}
      <Box
        sx={{
          width: size,
          height: size,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          // Temporarily remove white background to debug
          // backgroundColor: 'white',
          // borderRadius: '50%',
          // padding: size * 0.1, // 10% padding
          // boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
        }}
      >
        <img
          src="/oxford-house-logo.png"
          alt="Oxford House Logo"
          style={{
            width: '100%',
            height: '100%',
            objectFit: 'contain',
          }}
          onError={(e) => {
            console.error('Failed to load Oxford House logo from /oxford-house-logo.png');
            console.error('Error details:', e);
            // Fallback to a simple placeholder if image doesn't load
            const target = e.target as HTMLImageElement;
            target.style.display = 'none';
            target.parentElement!.innerHTML = `
              <div style="
                width: 100%;
                height: 100%;
                background: linear-gradient(135deg, #4CAF50 0%, #2196F3 100%);
                border-radius: 50%;
                display: flex;
                align-items: center;
                justify-content: center;
                color: white;
                font-weight: bold;
                font-size: ${size * 0.3}px;
                box-shadow: 0 2px 4px rgba(0,0,0,0.1);
              ">OH</div>
            `;
          }}
          onLoad={() => {
            console.log('Oxford House logo loaded successfully from /oxford-house-logo.png');
          }}
        />
      </Box>
      
      {/* Text (optional) */}
      {showText && (
        <Box sx={{ display: 'flex', flexDirection: 'column' }}>
          <Box
            component="span"
            sx={{
              fontSize: size * 0.4,
              fontWeight: 'bold',
              color: 'text.primary',
              lineHeight: 1,
            }}
          >
            Oxford House
          </Box>
          <Box
            component="span"
            sx={{
              fontSize: size * 0.25,
              color: 'text.secondary',
              lineHeight: 1,
            }}
          >
            Mileage Tracker
          </Box>
        </Box>
      )}
    </Box>
  );
};

export default OxfordHouseLogo;
