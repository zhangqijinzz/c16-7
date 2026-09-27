import { describe, expect, it } from 'vitest';
import { cropForRatio, moveCrop, resizeCrop } from '../domain';
import { DEFAULT_CROP } from '../model';

describe('crop domain rules', () => {
  it('fits a 1:1 crop inside a wide image and centers it', () => {
    const crop = cropForRatio('1:1', 1.5, DEFAULT_CROP);
    expect(crop.width).toBeCloseTo(2 / 3);
    expect(crop.height).toBe(1);
    expect(crop.x).toBeCloseTo(1 / 6);
  });

  it('clamps movement to the image boundary', () => {
    const crop = moveCrop({ ...DEFAULT_CROP, width: 0.5, height: 0.5 }, 0.9, -0.9, 1.5);
    expect(crop.x).toBe(0.5);
    expect(crop.y).toBe(0);
  });

  it('derives height from the image aspect ratio when resizing a locked crop', () => {
    // 1200×800（图片比例 1.5）上拖出 0.8 宽的 16:9 框：高度必须按图片比例换算，
    // 像素比例 (0.8 × 1.5) / 0.675 才是 16:9。
    const crop = resizeCrop({ ...DEFAULT_CROP, ratio: '16:9', width: 0.5, height: 0.28125 }, 0.8, 0.8, 1.5);
    expect(crop.width).toBe(0.8);
    expect(crop.height).toBeCloseTo(0.675);
    expect((crop.width * 1.5) / crop.height).toBeCloseTo(16 / 9);
  });

  it('keeps the locked ratio on images of any shape', () => {
    const tall = resizeCrop({ ...DEFAULT_CROP, ratio: '4:5' }, 0.6, 0.6, 0.5);
    expect((tall.width * 0.5) / tall.height).toBeCloseTo(4 / 5);
    const wide = resizeCrop({ ...DEFAULT_CROP, ratio: '1:1' }, 0.4, 0.4, 3);
    expect((wide.width * 3) / wide.height).toBeCloseTo(1);
    // 正方形图片是唯一与旧行为一致的特例
    const square = resizeCrop({ ...DEFAULT_CROP, ratio: '16:9' }, 0.8, 0.8, 1);
    expect(square.height).toBeCloseTo(0.45);
  });

  it('clamps size at the boundary without distorting the locked ratio', () => {
    // 1:1 框在 3:2 图片上拖到超出边界：高度先顶满，宽度必须跟着收小。
    const crop = resizeCrop({ ...DEFAULT_CROP, ratio: '1:1', x: 0.2, y: 0 }, 0.9, 0.9, 1.5);
    expect(crop.height).toBe(1);
    expect(crop.width).toBeCloseTo(2 / 3);
    expect((crop.width * 1.5) / crop.height).toBeCloseTo(1);
  });

  it('keeps the ratio when the position is clamped near the edge', () => {
    const start = { ...DEFAULT_CROP, ratio: '1:1', x: 0.5, y: 0.3, width: 0.4, height: 0.6 };
    const crop = moveCrop(start, 0.4, 0.4, 1.5);
    expect(crop.x).toBeCloseTo(1 - crop.width);
    expect(crop.y).toBeCloseTo(1 - crop.height);
    expect((crop.width * 1.5) / crop.height).toBeCloseTo(1);
  });
});
