export const IMAGE_SIZES = [
  { name: 'thumb', width: 320 },
  { name: 'medium', width: 800 },
  { name: 'large', width: 1600 },
] as const;

export const ALLOWED_IMAGE_FORMATS = new Set(['jpeg', 'png', 'webp']);
export const OUTPUT_IMAGE_MIME = 'image/webp';
