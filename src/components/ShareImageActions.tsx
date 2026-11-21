import { useState } from 'react';
import { Copy, Download, LoaderCircle } from 'lucide-react';
import { toBlob } from 'html-to-image';

type ShareImageActionsProps = {
  targetId: string;
  filename: string;
  size?: 'sm' | 'md';
};

export function ShareImageActions({ targetId, filename, size = 'sm' }: ShareImageActionsProps) {
  const [busy, setBusy] = useState<'copy' | 'download' | null>(null);
  const [message, setMessage] = useState('');

  const capture = async () => {
    const node = document.getElementById(targetId);
    if (!node) throw new Error('Area grafik atau tabel tidak ditemukan.');

    // Capture the full scrollable content, not only the visible viewport.
    const width = Math.max(node.scrollWidth, node.clientWidth);
    const height = Math.max(node.scrollHeight, node.clientHeight);
    const backgroundColor = getComputedStyle(node).backgroundColor;

    // Inline resolved SVG styles before capture. This preserves theme colors and
    // SVG class styling when html-to-image serializes the chart outside its CSS tree.
    const svgStyleProperties = [
      'fill', 'fill-opacity', 'stroke', 'stroke-width', 'stroke-opacity',
      'stroke-dasharray', 'stroke-linecap', 'stroke-linejoin', 'opacity',
      'font-family', 'font-size', 'font-weight', 'text-anchor',
      'dominant-baseline', 'paint-order', 'color', 'visibility', 'display',
      'vector-effect', 'shape-rendering', 'letter-spacing',
    ];
    const svgElements = Array.from(node.querySelectorAll<SVGElement>('svg, svg *'));
    const previousSvgStyles = svgElements.map(element => ({
      element,
      style: element.getAttribute('style'),
    }));

    try {
      svgElements.forEach(element => {
        const computed = window.getComputedStyle(element);
        svgStyleProperties.forEach(property => {
          const value = computed.getPropertyValue(property);
          if (value) element.style.setProperty(property, value);
        });
      });

      const blob = await toBlob(node, {
        cacheBust: true,
        pixelRatio: 2,
        filter: element => {
          if (!(element instanceof Element)) return true;
          if (element instanceof HTMLElement && element.classList.contains('share-image-actions')) return false;
          // SVG foreignObject tooltips and hover hit-zones are interactive overlays,
          // not part of the static chart image.
          if (element.classList.contains('combo-tooltip-fo') || element.classList.contains('combo-hover-zone')) return false;
          return true;
        },
        width,
        height,
        backgroundColor: backgroundColor === 'rgba(0, 0, 0, 0)' ? '#ffffff' : backgroundColor,
        style: {
          width: `${width}px`,
          height: `${height}px`,
          maxWidth: 'none',
          maxHeight: 'none',
          overflow: 'visible',
        },
      });
      if (!blob) throw new Error('Gambar gagal dibuat. Silakan coba lagi.');
      return blob;
    } finally {
      previousSvgStyles.forEach(({ element, style }) => {
        if (style == null) element.removeAttribute('style');
        else element.setAttribute('style', style);
      });
    }
  };

  const handleCopy = async () => {
    setBusy('copy');
    setMessage('');
    try {
      const blob = await capture();
      if (!navigator.clipboard?.write || typeof ClipboardItem === 'undefined') {
        throw new Error('Browser belum mendukung copy gambar. Gunakan Download PNG.');
      }
      await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
      setMessage('Gambar berhasil disalin.');
    } catch (error) {
      console.error('Copy image gagal:', error);
      setMessage(error instanceof Error ? error.message : 'Gagal menyalin gambar.');
    } finally {
      setBusy(null);
    }
  };

  const handleDownload = async () => {
    setBusy('download');
    setMessage('');
    try {
      const blob = await capture();
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = `${filename}.png`;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 1500);
      setMessage('PNG berhasil diunduh.');
    } catch (error) {
      console.error('Download image gagal:', error);
      setMessage(error instanceof Error ? error.message : 'Gagal mengunduh gambar.');
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className={`share-image-actions share-image-actions-${size}`}>
      <button type="button" onClick={handleCopy} disabled={busy !== null} title="Copy gambar" aria-label="Copy gambar">
        {busy === 'copy' ? <LoaderCircle size={13} className="share-image-spinner"/> : <Copy size={13}/>}
        <span>Copy Image</span>
      </button>
      <button type="button" onClick={handleDownload} disabled={busy !== null} title="Download PNG" aria-label="Download PNG">
        {busy === 'download' ? <LoaderCircle size={13} className="share-image-spinner"/> : <Download size={13}/>}
        <span>PNG</span>
      </button>
      {message && <span className="share-image-feedback" role="status">{message}</span>}
    </div>
  );
}
