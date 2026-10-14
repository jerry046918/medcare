import { describe, it, expect } from 'vitest';
import { reduceStage } from '../quickUploadMachine';

describe('quickUploadMachine', () => {
  it('正常流', () => {
    expect(reduceStage('capture', 'FILE_PICKED')).toBe('recognizing');
    expect(reduceStage('recognizing', 'OCR_OK')).toBe('review');
    expect(reduceStage('review', 'SUBMIT_OK')).toBe('done');
    expect(reduceStage('done', 'RESET')).toBe('capture');
  });
  it('OCR 失败 → error,RETRY 回 capture(保留文件由组件层负责),也可跳过', () => {
    expect(reduceStage('recognizing', 'OCR_FAIL')).toBe('error');
    expect(reduceStage('error', 'RETRY')).toBe('capture');
  });
  it('提交失败 → 回 review 可改后重试', () => {
    expect(reduceStage('review', 'SUBMIT_FAIL')).toBe('review');
  });
  it('非法迁移保持原状态', () => {
    expect(reduceStage('capture', 'OCR_OK')).toBe('capture');
  });
  it('OCR 失败可跳过识别直接进确认', () => {
    expect(reduceStage('error', 'SKIP')).toBe('review');
  });
  it('多选照片:保存后自动进入下一张', () => {
    expect(reduceStage('done', 'NEXT_FILE')).toBe('recognizing');
  });
});
