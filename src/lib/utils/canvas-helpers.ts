/**
 * Interactive Canvas & Camera Helpers
 */

export function setupSignaturePad(canvas: HTMLCanvasElement): {
  clear: () => void;
  isEmpty: () => boolean;
  toDataURL: () => string;
} {
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Could not get canvas context');

  ctx.lineWidth = 3;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.strokeStyle = '#0F172A';

  let drawing = false;
  let hasDrawn = false;

  const getPos = (e: MouseEvent | TouchEvent) => {
    const rect = canvas.getBoundingClientRect();
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
    return {
      x: (clientX - rect.left) * (canvas.width / rect.width),
      y: (clientY - rect.top) * (canvas.height / rect.height),
    };
  };

  const startDraw = (e: MouseEvent | TouchEvent) => {
    e.preventDefault();
    drawing = true;
    hasDrawn = true;
    const pos = getPos(e);
    ctx.beginPath();
    ctx.moveTo(pos.x, pos.y);
  };

  const draw = (e: MouseEvent | TouchEvent) => {
    if (!drawing) return;
    e.preventDefault();
    const pos = getPos(e);
    ctx.lineTo(pos.x, pos.y);
    ctx.stroke();
  };

  const stopDraw = () => {
    drawing = false;
  };

  canvas.addEventListener('mousedown', startDraw);
  canvas.addEventListener('mousemove', draw);
  window.addEventListener('mouseup', stopDraw);

  canvas.addEventListener('touchstart', startDraw, { passive: false });
  canvas.addEventListener('touchmove', draw, { passive: false });
  window.addEventListener('touchend', stopDraw);

  return {
    clear: () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      hasDrawn = false;
    },
    isEmpty: () => !hasDrawn,
    toDataURL: () => canvas.toDataURL('image/png'),
  };
}

/**
 * Apply High-Pass Document Scanner Contrast Filter to video frame canvas
 */
export function applyScannerFilter(canvas: HTMLCanvasElement): void {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const data = imgData.data;

  // Grayscale + Adaptive Thresholding for sharp document scan look
  for (let i = 0; i < data.length; i += 4) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    const gray = 0.299 * r + 0.587 * g + 0.114 * b;

    // High contrast curve
    const enhanced = gray > 140 ? 255 : gray < 70 ? 0 : (gray - 70) * (255 / 70);
    data[i] = enhanced;
    data[i + 1] = enhanced;
    data[i + 2] = enhanced;
  }

  ctx.putImageData(imgData, 0, 0);
}
