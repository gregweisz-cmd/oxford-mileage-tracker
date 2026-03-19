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
import * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf.mjs';
// pdf.js worker bundling can vary by toolchain; use require and normalize below.
// eslint-disable-next-line @typescript-eslint/no-var-requires
// @ts-ignore
const pdfWorkerSrc = require('pdfjs-dist/legacy/build/pdf.worker.min.mjs');

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

function isPdfSrc(src: string): boolean {
  const raw = (src || '').trim().toLowerCase();
  if (!raw) return false;
  if (raw.startsWith('data:application/pdf')) return true;
  const noQuery = raw.split('?')[0].split('#')[0];
  return noQuery.endsWith('.pdf');
}

/**
 * Render the first page of a PDF into a JPEG data URL.
 * Used so we can reuse the existing image-only crop UI for PDF receipts.
 */
async function renderPdfFirstPageToJpegDataUrl(pdfSrc: string): Promise<string> {
  const workerSrc = (pdfWorkerSrc as any)?.default ?? pdfWorkerSrc;
  pdfjsLib.GlobalWorkerOptions.workerSrc = workerSrc;

  const loadingTask = pdfjsLib.getDocument({ url: pdfSrc });
  const pdf = await loadingTask.promise;
  try {
    const page = await pdf.getPage(1);
    const viewport = page.getViewport({ scale: 2 });
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');
    if (!context) throw new Error('Canvas 2D context not available');

    canvas.width = Math.floor(viewport.width);
    canvas.height = Math.floor(viewport.height);

    // pdfjs-dist types are stricter than what we provide; runtime accepts this shape.
    await page.render({ canvasContext: context, viewport } as any).promise;
    return canvas.toDataURL('image/jpeg', 0.9);
  } finally {
    pdf.destroy();
  }
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
  const pdfReceipt = isPdfSrc(srcToLoad);
  const [renderingPdf, setRenderingPdf] = useState(false);
  const [renderedPdfImageSrc, setRenderedPdfImageSrc] = useState<string | null>(null);

  const handleClose = useCallback(() => {
    setCrop(undefined);
    setRenderedPdfImageSrc(null);
    onClose();
  }, [onClose]);

  const handleRenderPdf = useCallback(async () => {
    if (!pdfReceipt || !srcToLoad) return;
    setRenderingPdf(true);
    try {
      const rendered = await renderPdfFirstPageToJpegDataUrl(srcToLoad);
      setRenderedPdfImageSrc(rendered);
    } finally {
      setRenderingPdf(false);
    }
  }, [pdfReceipt, srcToLoad]);

  // Render PDF -> image once when modal opens.
  React.useEffect(() => {
    if (!open) return;
    if (!pdfReceipt) {
      setRenderedPdfImageSrc(null);
      return;
    }
    setRenderedPdfImageSrc(null);
    handleRenderPdf();
  }, [open, pdfReceipt, handleRenderPdf]);

  const handleApply = useCallback(async () => {
    if (!onApply || !imageSrc) return;
    const applySrc = pdfReceipt ? renderedPdfImageSrc : srcToLoad;
    if (pdfReceipt && !applySrc) return;
    const cropToUse = crop && crop.width > 0 && crop.height > 0
      ? crop
      : { unit: '%' as const, x: 0, y: 0, width: 100, height: 100 };
    setApplying(true);
    try {
      const img = await loadImageForCrop(applySrc || '');
      const dataUrl = drawCroppedToDataUrl(img, cropToUse);
      onApply(dataUrl);
      handleClose();
    } catch (e) {
      console.error('Crop failed:', e);
      alert('Could not load or crop the image. If this is a receipt from the server, check that the image URL is accessible and CORS allows this site.');
    } finally {
      setApplying(false);
    }
  }, [crop, imageSrc, srcToLoad, pdfReceipt, renderedPdfImageSrc, onApply, handleClose]);

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="md" fullWidth>
      <DialogTitle>Crop receipt image</DialogTitle>
      <DialogContent>
        <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: 320, bgcolor: '#f5f5f5' }}>
          {pdfReceipt && renderingPdf && (
            <Box sx={{ p: 3, textAlign: 'center' }}>
              Rendering PDF page for cropping…
            </Box>
          )}
          {(pdfReceipt ? !!renderedPdfImageSrc : !!imageSrc) && (
            <ReactCrop
              crop={crop}
              onChange={(_pixelCrop, percentCrop) => setCrop(percentCrop)}
              aspect={undefined}
            >
              <img
                src={pdfReceipt ? renderedPdfImageSrc || '' : srcToLoad}
                alt="Receipt"
                crossOrigin="anonymous"
                style={{ maxWidth: '100%', maxHeight: '70vh', display: 'block' }}
              />
            </ReactCrop>
          )}
        </Box>
      </DialogContent>
      <DialogActions>
        <Button onClick={handleClose} disabled={applying || renderingPdf}>Close</Button>
        {onApply && (
          <Button variant="contained" onClick={handleApply} disabled={applying || renderingPdf || (pdfReceipt && !renderedPdfImageSrc)}>
            {applying ? 'Applying…' : 'Apply crop'}
          </Button>
        )}
      </DialogActions>
    </Dialog>
  );
}
