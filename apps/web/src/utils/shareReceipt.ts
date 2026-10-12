import html2canvas from 'html2canvas';

// Shares a printed document (the exact same HTML string the print functions
// build) as a full-color PNG — completely decoupled from any printer's own
// black-and-white/grayscale setting, since it never touches the print
// pipeline at all. Renders the HTML into a hidden same-page iframe, captures
// it with html2canvas, then hands the image to the OS share sheet (WhatsApp,
// etc.) via the Web Share API, falling back to a plain download when that
// API or file-sharing isn't available (desktop browsers, older Safari/Firefox).
export async function shareHtmlAsImage(html: string, filename: string, width = 900) {
  const iframe = document.createElement('iframe');
  iframe.style.position = 'fixed';
  iframe.style.left = '-99999px';
  iframe.style.top = '0';
  iframe.style.width = `${width}px`;
  iframe.style.height = '100px'; // resized to content after load
  iframe.style.border = '0';
  document.body.appendChild(iframe);

  try {
    await new Promise<void>((resolve, reject) => {
      iframe.onload = () => resolve();
      iframe.onerror = () => reject(new Error('Preview failed to load'));
      iframe.srcdoc = html;
    });

    const doc = iframe.contentDocument;
    if (!doc) throw new Error('Could not access preview document');

    // Wait for every image inside (logo, QR code, signature) to finish loading.
    const images = Array.from(doc.images);
    await Promise.all(images.map((img) => img.complete ? Promise.resolve() : new Promise<void>((res) => {
      img.addEventListener('load', () => res(), { once: true });
      img.addEventListener('error', () => res(), { once: true });
    })));

    // Wait for the Google Fonts <link> tags to finish applying, where supported.
    await (doc.fonts?.ready ?? Promise.resolve()).catch(() => {});

    // Size the iframe to its real content height before capturing — otherwise
    // html2canvas (and the print CSS's own @media print rules) can clip it.
    const contentHeight = doc.documentElement.scrollHeight;
    iframe.style.height = `${contentHeight}px`;
    await new Promise((res) => setTimeout(res, 50)); // let the reflow settle

    const canvas = await html2canvas(doc.documentElement, {
      scale: 2, useCORS: true, backgroundColor: '#ffffff',
      width, height: contentHeight, windowWidth: width, windowHeight: contentHeight,
    });

    const blob: Blob | null = await new Promise((resolve) => canvas.toBlob((b) => resolve(b), 'image/png'));
    if (!blob) throw new Error('Image capture failed');

    const file = new File([blob], filename, { type: 'image/png' });

    if (navigator.canShare?.({ files: [file] })) {
      try {
        await navigator.share({ files: [file] });
      } catch (e) {
        if (e instanceof Error && e.name === 'AbortError') return; // user dismissed the share sheet — not an error
        throw e;
      }
      return;
    }

    // Fallback (desktop browsers, or share cancelled/unsupported) — just download the image.
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  } finally {
    document.body.removeChild(iframe);
  }
}
