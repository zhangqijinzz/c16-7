import { describe, expect, it } from 'vitest';
import { cropForRatio, moveCrop, resizeCrop } from '../domain';
import { DEFAULT_CROP, type CropVariant } from '../model';

describe('crop domain rules', () => {
  it('fits a 1:1 crop inside a wide image and centers it', () => {
    const crop = cropForRatio('1:1', 1.5, DEFAULT_CROP);
    expect(crop.width).toBeCloseTo(2 / 3);
    expect(crop.height).toBe(1);
    expect(crop.x).toBeCloseTo(1 / 6);
  });

  it('clamps movement to the image boundary', () => {
    const crop = moveCrop({ ...DEFAULT_CROP, width: 0.5, height: 0.5 }, 0.9, -0.9);
    expect(crop.x).toBe(0.5);
    expect(crop.y).toBe(0);
  });

  it('keeps a selected ratio while resizing on a square image', () => {
    const crop = resizeCrop({ ...DEFAULT_CROP, ratio: '16:9', width: 0.5, height: 0.5 }, 0.8, 0.9, 1);
    expect(crop.width).toBeCloseTo(0.8);
    expect(crop.height).toBeCloseTo(0.45);
  });

  it('accounts for the image aspect ratio while resizing on a non-square image', () => {
    // 1200×800 的示例图：屏幕像素比例 = (w*1200)/(h*800) = w/h * 1.5
    const start = { ...DEFAULT_CROP, ratio: '16:9' as const, width: 0.5, height: 0.5 };
    const crop = resizeCrop(start, 0.8, 0.9, 1.5);
    expect(crop.width).toBeCloseTo(0.8);
    // 正确高度 = 0.8 * 1.5 / (16/9) = 0.675；旧实现漏算图片比例会得到 0.45
    expect(crop.height).toBeCloseTo(0.675);
    expect((crop.width * 1.5) / crop.height).toBeCloseTo(16 / 9);
  });

  it('keeps the ratio through repeated resize steps without drift', () => {
    let crop: CropVariant = { ...DEFAULT_CROP, ratio: '4:5', width: 0.5, height: 0.5 };
    for (let step = 0; step < 6; step += 1) {
      crop = resizeCrop(crop, crop.width + 0.08, crop.height + 0.1, 1.5);
      expect((crop.width * 1.5) / crop.height).toBeCloseTo(4 / 5);
    }
  });

  it('scales the crop uniformly instead of distorting the ratio against a boundary', () => {
    // 1:1 在 1.5 的宽图上 height = width * 1.5。
    // 起点 x=0.6/y=0.1：到右边 0.4、到底边 0.9，先撞右边，等比停在 width=0.4。
    const oneSided = resizeCrop(
      { ...DEFAULT_CROP, ratio: '1:1' as const, x: 0.6, y: 0.1, width: 0.4, height: 0.6 },
      1.2, 1.2, 1.5,
    );
    expect(oneSided.x + oneSided.width).toBeCloseTo(1);
    expect(oneSided.width).toBeCloseTo(0.4);
    expect((oneSided.width * 1.5) / oneSided.height).toBeCloseTo(1);

    // 起点 x=0.6/y=0.4：两边各余 0.4，继续放大会同时撞右边和底边。
    const twoSided = resizeCrop(
      { ...DEFAULT_CROP, ratio: '1:1' as const, x: 0.6, y: 0.4, width: 0.4, height: 0.6 },
      1.2, 1.2, 1.5,
    );
    expect(twoSided.x + twoSided.width).toBeCloseTo(1);
    expect(twoSided.y + twoSided.height).toBeCloseTo(1);
    expect((twoSided.width * 1.5) / twoSided.height).toBeCloseTo(1);
  });

  it('does not change the size (only clamps position) when moving a locked crop', () => {
    const start = { ...DEFAULT_CROP, ratio: '1:1' as const, x: 0.2, y: 0.1, width: 0.4, height: 0.6 };
    const crop = moveCrop(start, 0.7, -0.9, 1.5);
    expect(crop.width).toBeCloseTo(0.4);
    expect(crop.height).toBeCloseTo(0.6);
    expect((crop.width * 1.5) / crop.height).toBeCloseTo(1);
  });
});
