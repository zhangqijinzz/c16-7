import { beforeEach, describe, expect, it } from 'vitest';
import { FrameSenseViewModel } from '../viewModel';
import { EMPTY_DOCUMENT, type FrameDocument, type ImageAsset } from '../model';
import type { FrameRepository } from '../repository';
import type { ImageService } from '../service';

class MemoryRepository implements FrameRepository {
  document: FrameDocument = structuredClone(EMPTY_DOCUMENT);
  fail = false;
  load() { return structuredClone(this.document); }
  save(document: FrameDocument) { if (this.fail) throw new Error('no storage'); this.document = structuredClone(document); }
}

class FakeImageService implements ImageService {
  asset: ImageAsset = { src: 'data:image/svg+xml,test', width: 1200, height: 800, name: 'test.svg' };
  readFile() { return Promise.resolve(this.asset); }
  demo() { return this.asset; }
}

describe('FrameSenseViewModel', () => {
  let repository: MemoryRepository;
  let vm: FrameSenseViewModel;
  beforeEach(() => { repository = new MemoryRepository(); vm = new FrameSenseViewModel(repository, new FakeImageService()); });

  it('initializes empty and loads a demo image', async () => {
    await vm.initialize();
    expect(vm.getSnapshot().phase).toBe('ready');
    vm.loadDemo();
    expect(vm.getSnapshot().document.image?.name).toBe('test.svg');
    expect(repository.document.image).not.toBeNull();
  });

  it('updates guides, subject, ratio, and variants', () => {
    vm.loadDemo();
    vm.toggleGuide('center');
    vm.markSubject(0.2, 0.8);
    vm.setRatio('1:1');
    vm.saveVariant();
    expect(vm.getSnapshot().document.guides.center).toBe(true);
    expect(vm.getSnapshot().document.subject).toEqual({ x: 0.2, y: 0.8 });
    expect(vm.getSnapshot().document.crop.ratio).toBe('1:1');
    expect(vm.getSnapshot().document.variants).toHaveLength(1);
  });

  it('keeps edits in memory and reports persistence failure', () => {
    repository.fail = true;
    vm.loadDemo();
    expect(vm.getSnapshot().phase).toBe('error');
    expect(vm.getSnapshot().document.image).not.toBeNull();
    expect(vm.getSnapshot().error).toContain('本地保存失败');
  });

  it('preserves a locked ratio through resize, saved variant, and variant switching', () => {
    vm.loadDemo(); // 1200×800, imageRatio = 1.5
    vm.setRatio('1:1');
    vm.resizeCrop(0.6, 0.6);
    const crop = vm.getSnapshot().document.crop;
    // 1:1 在 1200×800 图上：height = width * 1.5 = 0.9
    expect(crop.height).toBeCloseTo(0.9);
    expect((crop.width * 1.5) / crop.height).toBeCloseTo(1);

    vm.saveVariant();
    const saved = repository.document.variants[0];
    expect(saved.ratio).toBe('1:1');
    expect((saved.width * 1.5) / saved.height).toBeCloseTo(1);

    vm.resizeCrop(0.3, 0.3);
    vm.selectVariant(saved.id);
    const restored = vm.getSnapshot().document.crop;
    expect(restored.width).toBeCloseTo(saved.width);
    expect((restored.width * 1.5) / restored.height).toBeCloseTo(1);
  });

  it('repairs distorted legacy crops when reopening a saved document', () => {
    // 旧版本漏算图片比例时可能存下的走样数据：标注 16:9 但实际像素比例约 2.67:1
    repository.document = {
      ...structuredClone(repository.document),
      image: { src: 'data:image/svg+xml,test', width: 1200, height: 800, name: 'test.svg' },
      crop: { id: 'current', x: 0.1, y: 0.1, width: 0.8, height: 0.45, ratio: '16:9' },
      variants: [
        { id: 'variant-old', x: 0, y: 0, width: 0.5, height: 0.28125, ratio: '16:9' },
      ],
    };
    void vm.initialize();
    const crop = vm.getSnapshot().document.crop;
    expect(crop.width).toBeCloseTo(0.8);
    // 修正后高度 = 0.8 * 1.5 / (16/9) = 0.675
    expect(crop.height).toBeCloseTo(0.675);
    expect((crop.width * 1.5) / crop.height).toBeCloseTo(16 / 9);
    const variant = vm.getSnapshot().document.variants[0];
    expect(variant.height).toBeCloseTo(0.5 * 1.5 / (16 / 9));
    expect((variant.width * 1.5) / variant.height).toBeCloseTo(16 / 9);
  });
});
