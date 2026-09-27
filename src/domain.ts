import type { CropVariant, FrameDocument, Ratio } from './model';

const clamp = (value: number, min = 0, max = 1): number => Math.min(max, Math.max(min, value));

// 裁切框的 width/height 是相对原图的归一化尺寸，屏幕上的实际像素宽高比为
// (width * imageWidth) / (height * imageHeight) = width / height * imageRatio。
// 令其等于锁定比例 w/h，可得 height = width * imageRatio / (w / h)，
// 必须把图片自身的宽高比 imageRatio 一并计入。
function heightForRatio(ratio: string, width: number, imageRatio: number): number {
  const [w, h] = ratio.split(':').map(Number);
  return (width * imageRatio) / (w / h);
}

// 仅夹紧位置，不改变尺寸：用于拖动裁切框。
export function normalizeCrop(crop: CropVariant, imageRatio = 1): CropVariant {
  let { width, height } = crop;
  if (crop.ratio !== 'free') height = heightForRatio(crop.ratio, width, imageRatio);
  width = clamp(width, 0.12, 1);
  height = clamp(height, 0.12, 1);
  return {
    ...crop,
    x: clamp(crop.x, 0, Math.max(0, 1 - width)),
    y: clamp(crop.y, 0, Math.max(0, 1 - height)),
    width,
    height,
  };
}

// 等比缩小以完整落在原图内：用于缩放裁切框，贴边夹紧时宽高施加同一系数，比例不变形。
function fitCropInside(crop: CropVariant, imageRatio: number): CropVariant {
  if (crop.ratio === 'free') return normalizeCrop(crop, imageRatio);
  let width = clamp(crop.width, 0.12, 1);
  let height = heightForRatio(crop.ratio, width, imageRatio);
  const scale = Math.min(1, (1 - crop.x) / width, (1 - crop.y) / height);
  width = clamp(width * scale, 0.12, 1);
  height = heightForRatio(crop.ratio, width, imageRatio);
  return { ...crop, x: crop.x, y: crop.y, width, height };
}

export function cropForRatio(ratio: Ratio, imageRatio: number, current: CropVariant): CropVariant {
  if (ratio === 'free') return { ...current, ratio };
  const [w, h] = ratio.split(':').map(Number);
  const target = w / h;
  let width = 1;
  let height = 1;
  if (target > imageRatio) height = Math.min(1, imageRatio / target);
  else width = Math.min(1, target / imageRatio);
  return normalizeCrop({
    ...current,
    ratio,
    width,
    height,
    x: (1 - width) / 2,
    y: (1 - height) / 2,
  }, imageRatio);
}

export function moveCrop(crop: CropVariant, dx: number, dy: number, imageRatio = 1): CropVariant {
  return normalizeCrop({ ...crop, x: crop.x + dx, y: crop.y + dy }, imageRatio);
}

export function resizeCrop(crop: CropVariant, width: number, height: number, imageRatio = 1): CropVariant {
  const nextWidth = width;
  let nextHeight = height;
  if (crop.ratio !== 'free') {
    nextHeight = heightForRatio(crop.ratio, nextWidth, imageRatio);
  }
  return fitCropInside({ ...crop, width: nextWidth, height: nextHeight }, imageRatio);
}

export function makeVariant(crop: CropVariant, id: string, imageRatio = 1): CropVariant {
  return { ...normalizeCrop(crop, imageRatio), id };
}

export function isFrameDocument(value: unknown): value is FrameDocument {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<FrameDocument>;
  return candidate.version === 1 && typeof candidate.guides === 'object' && candidate.crop !== undefined && Array.isArray(candidate.variants);
}
