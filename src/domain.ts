import type { CropVariant, FrameDocument, Ratio } from './model';

const clamp = (value: number, min = 0, max = 1): number => Math.min(max, Math.max(min, value));

const MIN_CROP_SIZE = 0.12;

function parseRatio(ratio: string): number | null {
  if (ratio === 'free') return null;
  const [w, h] = ratio.split(':').map(Number);
  if (!Number.isFinite(w) || !Number.isFinite(h) || w <= 0 || h <= 0) return null;
  return w / h;
}

export function normalizeCrop(crop: CropVariant, imageRatio: number): CropVariant {
  const target = parseRatio(crop.ratio);
  let width: number;
  let height: number;
  if (target !== null && imageRatio > 0) {
    // 锁定比例时宽高必须联动夹紧：先按图片自身比例算出宽度的允许范围，
    // 再由宽度反推高度，靠近边界时单独夹紧某一维会把画面拉伸变形。
    const heightPerWidth = imageRatio / target;
    const maxWidth = Math.min(1, 1 / heightPerWidth);
    const minWidth = Math.min(maxWidth, MIN_CROP_SIZE / Math.min(1, heightPerWidth));
    width = clamp(crop.width, minWidth, maxWidth);
    height = width * heightPerWidth;
  } else {
    width = clamp(crop.width, MIN_CROP_SIZE, 1);
    height = clamp(crop.height, MIN_CROP_SIZE, 1);
  }
  return {
    ...crop,
    x: clamp(crop.x, 0, 1 - width),
    y: clamp(crop.y, 0, 1 - height),
    width,
    height,
  };
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

export function moveCrop(crop: CropVariant, dx: number, dy: number, imageRatio: number): CropVariant {
  return normalizeCrop({ ...crop, x: crop.x + dx, y: crop.y + dy }, imageRatio);
}

export function resizeCrop(crop: CropVariant, width: number, height: number, imageRatio: number): CropVariant {
  const target = parseRatio(crop.ratio);
  const nextWidth = width;
  // 裁切框尺寸是图片的归一化比例，换算像素比例时必须乘上图片自身的长宽比。
  const nextHeight = target === null ? height : (nextWidth * imageRatio) / target;
  return normalizeCrop({ ...crop, width: nextWidth, height: nextHeight }, imageRatio);
}

export function makeVariant(crop: CropVariant, id: string, imageRatio: number): CropVariant {
  return { ...normalizeCrop(crop, imageRatio), id };
}

export function isFrameDocument(value: unknown): value is FrameDocument {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<FrameDocument>;
  return candidate.version === 1 && typeof candidate.guides === 'object' && candidate.crop !== undefined && Array.isArray(candidate.variants);
}
