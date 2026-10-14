/**
 * 快速上传向导状态机（纯函数）
 *
 * stage: 'capture' | 'recognizing' | 'review' | 'done' | 'error'
 * event: 'START' | 'FILE_PICKED' | 'OCR_OK' | 'OCR_FAIL' | 'RETRY' | 'SKIP'
 *        | 'SUBMIT_OK' | 'SUBMIT_FAIL' | 'NEXT_FILE' | 'RESET'
 *
 * - SKIP:       OCR 失败后跳过识别，直接进入手动确认（照片保留随表单提交）
 * - NEXT_FILE:  多选照片队列中还有下一张，保存后自动进入识别
 * - 非法迁移一律保持原状态
 */
const TRANSITIONS = {
  capture:     { FILE_PICKED: 'recognizing', RESET: 'capture' },
  recognizing: { OCR_OK: 'review', OCR_FAIL: 'error' },
  error:       { RETRY: 'capture', SKIP: 'review' },
  review:      { SUBMIT_OK: 'done', SUBMIT_FAIL: 'review' },
  done:        { NEXT_FILE: 'recognizing', RESET: 'capture' }
};

export function reduceStage(stage, event) {
  return (TRANSITIONS[stage] && TRANSITIONS[stage][event]) || stage;
}
