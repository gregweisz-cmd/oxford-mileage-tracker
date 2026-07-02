import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  Slider,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import { Close as CloseIcon, Delete as DeleteIcon } from '@mui/icons-material';

export interface ReceiptImageAnnotateModalProps {
  open: boolean;
  imageSrc: string;
  onClose: () => void;
  onApply?: (annotatedDataUrl: string) => void;
}

interface TextAnnotation {
  id: string;
  xPercent: number;
  yPercent: number;
  text: string;
  fontSize: number;
}

function loadImageElement(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Failed to load image'));
    img.src = src;
  });
}

function flattenAnnotationsToDataUrl(
  img: HTMLImageElement,
  annotations: TextAnnotation[]
): string {
  const canvas = document.createElement('canvas');
  canvas.width = img.naturalWidth;
  canvas.height = img.naturalHeight;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas 2d context not available');

  ctx.drawImage(img, 0, 0);
  ctx.fillStyle = '#000000';
  ctx.textBaseline = 'top';

  for (const annotation of annotations) {
    const text = annotation.text.trim();
    if (!text) continue;
    const x = (annotation.xPercent / 100) * canvas.width;
    const y = (annotation.yPercent / 100) * canvas.height;
    const fontSize = Math.max(12, Math.round((annotation.fontSize / 100) * canvas.height));
    ctx.font = `${fontSize}px Arial, Helvetica, sans-serif`;
    ctx.fillText(text, x, y);
  }

  return canvas.toDataURL('image/jpeg', 0.92);
}

export default function ReceiptImageAnnotateModal({
  open,
  imageSrc,
  onClose,
  onApply,
}: ReceiptImageAnnotateModalProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [annotations, setAnnotations] = useState<TextAnnotation[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [fontSize, setFontSize] = useState(3.5);
  const [draftText, setDraftText] = useState('');
  const [imageSize, setImageSize] = useState({ width: 0, height: 0 });
  const [displaySize, setDisplaySize] = useState({ width: 0, height: 0 });
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [saving, setSaving] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  const selectedAnnotation = useMemo(
    () => annotations.find((item) => item.id === selectedId) || null,
    [annotations, selectedId]
  );

  const resetState = useCallback(() => {
    setAnnotations([]);
    setSelectedId(null);
    setFontSize(3.5);
    setDraftText('');
    setImageSize({ width: 0, height: 0 });
    setDisplaySize({ width: 0, height: 0 });
    setDraggingId(null);
    setLoadError(null);
  }, []);

  const handleClose = useCallback(() => {
    resetState();
    onClose();
  }, [onClose, resetState]);

  useEffect(() => {
    if (!open || !imageSrc) return;

    let cancelled = false;
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      if (cancelled) return;
      setImageSize({ width: img.naturalWidth, height: img.naturalHeight });
      setLoadError(null);
    };
    img.onerror = () => {
      if (!cancelled) setLoadError('Could not load the receipt image.');
    };
    img.src = imageSrc;

    return () => {
      cancelled = true;
    };
  }, [open, imageSrc]);

  useEffect(() => {
    if (!open || !imageSrc || !containerRef.current) return;

    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      const maxWidth = Math.min(containerRef.current?.clientWidth || 720, 900);
      const maxHeight = 520;
      const scale = Math.min(maxWidth / img.naturalWidth, maxHeight / img.naturalHeight, 1);
      setDisplaySize({
        width: Math.round(img.naturalWidth * scale),
        height: Math.round(img.naturalHeight * scale),
      });
    };
    img.src = imageSrc;
  }, [open, imageSrc, imageSize.width, imageSize.height]);

  useEffect(() => {
    if (selectedAnnotation) {
      setDraftText(selectedAnnotation.text);
      setFontSize(selectedAnnotation.fontSize);
    }
  }, [selectedAnnotation]);

  const addAnnotationAt = (clientX: number, clientY: number) => {
    const container = containerRef.current;
    if (!container) return;
    const rect = container.getBoundingClientRect();
    const x = clientX - rect.left;
    const y = clientY - rect.top;
    if (x < 0 || y < 0 || x > rect.width || y > rect.height) return;

    const id = `text-${Date.now()}`;
    const next: TextAnnotation = {
      id,
      xPercent: (x / rect.width) * 100,
      yPercent: (y / rect.height) * 100,
      text: 'Text',
      fontSize,
    };
    setAnnotations((prev) => [...prev, next]);
    setSelectedId(id);
    setDraftText(next.text);
  };

  const updateSelectedAnnotation = (updates: Partial<TextAnnotation>) => {
    if (!selectedId) return;
    setAnnotations((prev) =>
      prev.map((item) => (item.id === selectedId ? { ...item, ...updates } : item))
    );
  };

  const handlePointerMove = (event: React.PointerEvent) => {
    if (!draggingId || !containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const x = event.clientX - rect.left - dragOffset.x;
    const y = event.clientY - rect.top - dragOffset.y;
    const xPercent = Math.min(95, Math.max(0, (x / rect.width) * 100));
    const yPercent = Math.min(95, Math.max(0, (y / rect.height) * 100));
    setAnnotations((prev) =>
      prev.map((item) =>
        item.id === draggingId ? { ...item, xPercent, yPercent } : item
      )
    );
  };

  const handleSave = async () => {
    if (!onApply || !imageSrc) return;
    setSaving(true);
    try {
      const img = await loadImageElement(imageSrc);
      const dataUrl = flattenAnnotationsToDataUrl(img, annotations);
      onApply(dataUrl);
      handleClose();
    } catch (error) {
      console.error('Annotate save failed:', error);
      setLoadError('Could not save annotated image. Try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="md" fullWidth>
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        Add text to receipt
        <IconButton onClick={handleClose} aria-label="Close">
          <CloseIcon />
        </IconButton>
      </DialogTitle>
      <DialogContent>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          Click the receipt to place text, drag labels to move them, then save. This works like typing on a
          receipt in Preview — the text is burned into the image.
        </Typography>

        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} sx={{ mb: 2 }}>
          <TextField
            label="Selected text"
            value={draftText}
            onChange={(event) => {
              const value = event.target.value;
              setDraftText(value);
              updateSelectedAnnotation({ text: value });
            }}
            disabled={!selectedId}
            fullWidth
            size="small"
          />
          <Box sx={{ minWidth: 180 }}>
            <Typography variant="caption" color="text.secondary">
              Text size
            </Typography>
            <Slider
              size="small"
              min={2}
              max={8}
              step={0.25}
              value={fontSize}
              disabled={!selectedId}
              onChange={(_, value) => {
                const next = Array.isArray(value) ? value[0] : value;
                setFontSize(next);
                updateSelectedAnnotation({ fontSize: next });
              }}
            />
          </Box>
          <Button
            variant="outlined"
            color="error"
            startIcon={<DeleteIcon />}
            disabled={!selectedId}
            onClick={() => {
              if (!selectedId) return;
              setAnnotations((prev) => prev.filter((item) => item.id !== selectedId));
              setSelectedId(null);
              setDraftText('');
            }}
          >
            Delete text
          </Button>
        </Stack>

        {loadError && (
          <Typography color="error" variant="body2" sx={{ mb: 2 }}>
            {loadError}
          </Typography>
        )}

        <Box sx={{ display: 'flex', justifyContent: 'center', bgcolor: '#f5f5f5', p: 2, borderRadius: 1 }}>
          <Box
            ref={containerRef}
            sx={{
              position: 'relative',
              width: displaySize.width || '100%',
              height: displaySize.height || 360,
              maxWidth: '100%',
              cursor: 'crosshair',
              userSelect: 'none',
            }}
            onClick={(event) => {
              if ((event.target as HTMLElement).dataset.annotationId) return;
              addAnnotationAt(event.clientX, event.clientY);
            }}
            onPointerMove={handlePointerMove}
            onPointerUp={() => setDraggingId(null)}
            onPointerLeave={() => setDraggingId(null)}
          >
            {!!imageSrc && (
              <img
                src={imageSrc}
                alt="Receipt"
                style={{
                  width: displaySize.width || '100%',
                  height: displaySize.height || 'auto',
                  display: 'block',
                  pointerEvents: 'none',
                }}
              />
            )}
            {annotations.map((annotation) => {
              const isSelected = annotation.id === selectedId;
              const fontPx = Math.max(
                12,
                Math.round((annotation.fontSize / 100) * (displaySize.height || 360))
              );
              return (
                <Box
                  key={annotation.id}
                  data-annotation-id={annotation.id}
                  onClick={(event) => {
                    event.stopPropagation();
                    setSelectedId(annotation.id);
                  }}
                  onPointerDown={(event) => {
                    event.stopPropagation();
                    setSelectedId(annotation.id);
                    setDraggingId(annotation.id);
                    const rect = (event.currentTarget as HTMLElement).getBoundingClientRect();
                    setDragOffset({
                      x: event.clientX - rect.left,
                      y: event.clientY - rect.top,
                    });
                  }}
                  sx={{
                    position: 'absolute',
                    left: `${annotation.xPercent}%`,
                    top: `${annotation.yPercent}%`,
                    transform: 'translate(0, 0)',
                    color: '#000',
                    fontSize: `${fontPx}px`,
                    fontFamily: 'Arial, Helvetica, sans-serif',
                    lineHeight: 1.1,
                    px: 0.5,
                    border: isSelected ? '1px dashed #1976d2' : '1px dashed transparent',
                    backgroundColor: isSelected ? 'rgba(255,255,255,0.35)' : 'transparent',
                    cursor: 'move',
                    whiteSpace: 'pre-wrap',
                    maxWidth: '80%',
                  }}
                >
                  {annotation.text || 'Text'}
                </Box>
              );
            })}
          </Box>
        </Box>
      </DialogContent>
      <DialogActions>
        <Button onClick={handleClose} disabled={saving}>
          Cancel
        </Button>
        {onApply && (
          <Button variant="contained" onClick={() => void handleSave()} disabled={saving || !imageSrc}>
            {saving ? 'Saving…' : 'Save annotated image'}
          </Button>
        )}
      </DialogActions>
    </Dialog>
  );
}
