const MAX_SIZE = 480; // px, longest side - plenty for avatars
const QUALITY = 0.82;

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Could not read that image'));
    img.src = src;
  });
}

const readAsDataUrl = (file) =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error('Could not read that image'));
    reader.readAsDataURL(file);
  });

/**
 * Resizes a photo (File or data URL) to at most 480px and re-encodes it as JPEG,
 * turning multi-megabyte camera photos into ~30-80KB data URLs that fit in an
 * API request and a saved form draft.
 */
export async function resizeImage(source) {
  const src = typeof source === 'string' ? source : await readAsDataUrl(source);
  const img = await loadImage(src);
  const scale = Math.min(1, MAX_SIZE / Math.max(img.width, img.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(img.width * scale);
  canvas.height = Math.round(img.height * scale);
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#fff'; // PNG transparency would turn black in JPEG
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL('image/jpeg', QUALITY);
}

/** Shrinks an inline photo that is still too large (e.g. from an older draft). */
export async function shrinkPhoto(dataUrl) {
  if (!dataUrl || !dataUrl.startsWith('data:') || dataUrl.length < 300_000) return dataUrl;
  try {
    return await resizeImage(dataUrl);
  } catch {
    return dataUrl;
  }
}
