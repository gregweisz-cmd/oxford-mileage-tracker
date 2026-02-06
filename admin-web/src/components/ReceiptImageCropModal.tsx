import React, { useState, useCallback } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Box,
} from '@mui/material';
import ReactCrop, { type Crop } from 'react-image-crop';
import 'react-image-crop/dist/ReactCrop.css';

export interface ReceiptImageCropModalProps {
  open: boolean;
  imageSrc: string;
  onClose: () => void;
  onApply?: (croppedDataUrl: string) => void;
}

/** Convert crop to pixel values (react-image-crop can use % or px). */
function getPixelCrop(crop: Crop, width: number, height: number): { x: number; y: number; width: number; height: number } {
  if (crop.unit === '%') {
    return {
      x: (crop.x / 100) * width,
      y: (crop.y / 100) * height,
      width: (crop.width / 100) * width,
      height: (crop.height / 100) * height,
    };
  }
  return { x: crop.x, y: crop.y, width: crop.width, height: crop.height };
}

/** Draw cropped region to a canvas and return as JPEG data URL. */
function drawCroppedToDataUrl(img: HTMLImageElement, crop: Crop): string {
  const { x, y, width, height } = getPixelCrop(crop, img.naturalWidth, img.naturalHeight);
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas 2d context not available');
  ctx.drawImage(img, x, y, width, height, 0, 0, width, height);
  return canvas.toDataURL('image/jpeg', 0.9);
}

/** Load image from URL (data: or http) into a new Image. Uses fetch for http(s) so we control CORS and get a drawable image. */
function loadImageForCrop(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    if (src.startsWith('data:')) {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error('Failed to load image'));
      img.src = src;
      return;
    }
    fetch(src, { mode: 'cors', credentials: 'omit' })
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.blob();
      })
      .then((blob) => {
        const url = URL.createObjectURL(blob);
        const img = new Image();
        img.onload = () => {
          URL.revokeObjectURL(url);
          resolve(img);
        };
        img.onerror = () => {
          URL.revokeObjectURL(url);
          reject(new Error('Failed to decode image'));
        };
        img.src = url;
      })
      .catch(reject);
  });
}

/** For cross-origin URLs, append a cache-bust param so the browser refetches with CORS. */
function imageSrcWithCors(imageSrc: string): string {
  if (!imageSrc || imageSrc.startsWith('data:')) return imageSrc;
  try {
    const u = new URL(imageSrc, window.location.origin);
    if (u.origin !== window.location.origin) {
      u.searchParams.set('_cors', String(Date.now()));
      return u.toString();
    }
  } catch (_) { /* ignore */ }
  return imageSrc;
}

export default function ReceiptImageCropModal({
  open,
  imageSrc,
  onClose,
  onApply,
}: ReceiptImageCropModalProps) {
  const [crop, setCrop] = useState<Crop | undefined>(undefined);
  const [applying, setApplying] = useState(false);
  const srcToLoad = imageSrcWithCors(imageSrc);

  const handleClose = useCallback(() => {
    setCrop(undefined);
    onClose();
  }, [onClose]);

  const handleApply = useCallback(async () => {
    if (!onApply || !imageSrc) return;
    const cropToUse = crop && crop.width > 0 && crop.height > 0
      ? crop
      : { unit: '%' as const, x: 0, y: 0, width: 100, height: 100 };
    setApplying(true);
    try {
      const img = await loadImageForCrop(srcToLoad);
      const dataUrl = drawCroppedToDataUrl(img, cropToUse);
      onApply(dataUrl);
      handleClose();
    } catch (e) {
      console.error('Crop failed:', e);
      alert('Could not load or crop the image. If this is a receipt from the server, check that the image URL is accessible and CORS allows this site.');
    } finally {
      setApplying(false);
    }
  }, [crop, imageSrc, srcToLoad, onApply, handleClose]);

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="md" fullWidth>
      <DialogTitle>Crop receipt image</DialogTitle>
      <DialogContent>
        <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: 320, bgcolor: '#f5f5f5' }}>
          {imageSrc && (
            <ReactCrop
              crop={crop}
              onChange={(_pixelCrop, percentCrop) => setCrop(percentCrop)}
              aspect={undefined}
            >
              <img
                src={srcToLoad}
                alt="Receipt"
                crossOrigin="anonymous"
                style={{ maxWidth: '100%', maxHeight: '70vh', display: 'block' }}
              />
            </ReactCrop>
          )}
        </Box>
      </DialogContent>
      <DialogActions>
        <Button onClick={handleClose} disabled={applying}>Close</Button>
        {onApply && (
          <Button variant="contained" onClick={handleApply} disabled={applying}>
            {applying ? 'Applying…' : 'Apply crop'}
          </Button>
        )}
      </DialogActions>
    </Dialog>
  );
}
