import React from 'react';
import { Box } from '@mui/material';
import { debugError } from '../config/debug';

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
        }}
      >
        <img
          src="/oxford-house-logo.png"
          alt="Oxford House Logo"
          style={{
            width: '100%',
            height: '100%',
            objectFit: 'contain',
            display: 'block',
            maxWidth: '100%',
            maxHeight: '100%',
            imageRendering: 'auto', // Use high-quality rendering
          }}
          loading="eager"
          decoding="sync" // Decode synchronously for immediate display
          onLoad={(e) => {
            // Ensure image is displayed at full quality
            const img = e.target as HTMLImageElement;
            img.style.imageRendering = 'auto';
          }}
          onError={(e) => {
            debugError('Failed to load Oxford House logo from /oxford-house-logo.png');
            debugError('Error details:', e);
            // Fallback to a simple placeholder if image doesn't load
            const target = e.target as HTMLImageElement;
            target.style.display = 'none';
            target.parentElement!.innerHTML = `
              <svg width="100%" height="100%" viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
                <!-- Green O - outer circle -->
                <circle cx="50" cy="50" r="45" fill="#4CAF50" stroke="none"/>
                
                <!-- Blue H with integrated house -->
                <g>
                  <!-- Left vertical bar of H -->
                  <rect x="22" y="15" width="10" height="60" fill="#2196F3"/>
                  
                  <!-- Right vertical bar of H -->
                  <rect x="68" y="15" width="10" height="60" fill="#2196F3"/>
                  
                  <!-- Horizontal bar of H -->
                  <rect x="22" y="40" width="56" height="10" fill="#2196F3"/>
                  
                  <!-- House roof (triangle) - integrated into H -->
                  <polygon points="22,50 50,30 78,50" fill="#2196F3"/>
                  
                  <!-- House base (rectangle) - bottom part of H -->
                  <rect x="27" y="50" width="46" height="25" fill="#2196F3"/>
                  
                  <!-- House door -->
                  <rect x="45" y="60" width="10" height="15" fill="#1976D2"/>
                </g>
              </svg>
            `;
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
            Expense Tracker
          </Box>
        </Box>
      )}
    </Box>
  );
};

export default OxfordHouseLogo;
