// Resize + compress an image in-browser before upload. whiteBackground=true
// flattens transparency onto white (right for real camera photos and OCR
// scans); false preserves transparency as PNG (right for logos).
export async function compressImage(file: File, opts: { maxDim: number; whiteBackground: boolean }): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const img = document.createElement('img') as HTMLImageElement;
    const url = URL.createObjectURL(file);
    img.onload = () => {
      let w = img.naturalWidth;
      let h = img.naturalHeight;
      if (w > opts.maxDim || h > opts.maxDim) {
        if (w > h) { h = Math.round((h * opts.maxDim) / w); w = opts.maxDim; }
        else       { w = Math.round((w * opts.maxDim) / h); h = opts.maxDim; }
      }
      const canvas = document.createElement('canvas');
      canvas.width = w; canvas.height = h;
      const ctx = canvas.getContext('2d')!;
      if (opts.whiteBackground) {
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, w, h);
      }
      ctx.drawImage(img, 0, 0, w, h);
      canvas.toBlob(
        (blob) => blob ? resolve(blob) : reject(new Error('Compression failed')),
        opts.whiteBackground ? 'image/jpeg' : 'image/png',
        0.90,
      );
      URL.revokeObjectURL(url);
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Could not load image')); };
    img.src = url;
  });
}
