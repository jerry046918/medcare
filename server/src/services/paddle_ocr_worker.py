#!/usr/bin/env python3
"""
PaddleOCR 工作脚本
用于 Node.js 调用 PaddleOCR 进行文字识别
适配 PaddleOCR 2.7.x API
"""

import sys
import json
import argparse
import os
import warnings
from pathlib import Path

# ========== 修复 Windows 编码问题 ==========
# 强制设置 stdout 为 UTF-8 编码（避免中文乱码）
if sys.platform == 'win32':
    sys.stdout.reconfigure(encoding='utf-8')
    sys.stderr.reconfigure(encoding='utf-8')

# ========== 重要：在导入 paddle 之前设置环境变量 ==========
# 禁用 OneDNN（避免 Windows 兼容性问题）
os.environ['FLAGS_use_mkldnn'] = '0'
os.environ['FLAGS_enable_onednn_backend'] = '0'
os.environ['FLAGS_use_onednn'] = '0'

# 设置模型缓存目录到不含中文的路径（避免中文路径问题）
MODEL_CACHE_DIR = Path('C:/paddleocr_models')
MODEL_CACHE_DIR.mkdir(parents=True, exist_ok=True)

# 设置 PaddleOCR 模型缓存目录
os.environ['PPOCR_MODEL_DIR'] = str(MODEL_CACHE_DIR)
os.environ['PPOCR_DOWNLOAD'] = str(MODEL_CACHE_DIR)

# 禁用警告
warnings.filterwarnings('ignore')

try:
    from paddleocr import PaddleOCR
except ImportError:
    print(json.dumps({
        'success': False,
        'error': 'PaddleOCR 未安装，请运行: pip install paddleocr'
    }))
    sys.exit(1)


def main():
    parser = argparse.ArgumentParser(description='PaddleOCR 文字识别')
    parser.add_argument('image_path', help='图片路径')
    parser.add_argument('--lang', default='ch', help='语言 (ch, en, etc.)')
    args = parser.parse_args()

    # 检查文件是否存在
    if not Path(args.image_path).exists():
        print(json.dumps({
            'success': False,
            'error': f'图片文件不存在: {args.image_path}'
        }))
        sys.exit(1)

    try:
        # 初始化 OCR (使用 PaddleOCR 2.7.x API)
        # 使用项目目录中的模型（避免中文路径问题）
        det_model = MODEL_CACHE_DIR / 'det' / 'ch' / 'ch_PP-OCRv4_det_infer'
        rec_model = MODEL_CACHE_DIR / 'rec' / 'ch' / 'ch_PP-OCRv4_rec_infer'
        cls_model = MODEL_CACHE_DIR / 'cls' / 'ch_ppocr_mobile_v2.0_cls_infer'
        
        ocr = PaddleOCR(
            use_angle_cls=True,
            lang=args.lang,
            show_log=False,
            enable_mkldnn=False,  # 禁用 MKLDNN（避免 Windows 兼容性问题）
            det_model_dir=str(det_model) if det_model.exists() else None,
            rec_model_dir=str(rec_model) if rec_model.exists() else None,
            cls_model_dir=str(cls_model) if cls_model.exists() else None
        )
        # 执行识别 - 使用 ocr() 方法
        result = ocr.ocr(args.image_path, cls=True)

        # 解析结果 - 旧 API 返回格式
        text_lines = []
        boxes = []
        confidences = []

        if result and result[0]:
            for line in result[0]:
                box = line[0]  # 坐标
                text_info = line[1]  # (文字, 置信度)
                
                text = text_info[0]
                confidence = float(text_info[1])
                
                text_lines.append(text)
                boxes.append(box)
                confidences.append(confidence)

        # 计算平均置信度
        avg_confidence = sum(confidences) / len(confidences) if confidences else 0

        # 输出 JSON 结果
        output = {
            'success': True,
            'text': '\n'.join(text_lines),
            'lines': text_lines,
            'boxes': boxes,
            'confidences': confidences,
            'confidence': avg_confidence
        }

        print(json.dumps(output, ensure_ascii=False))

    except Exception as e:
        print(json.dumps({
            'success': False,
            'error': str(e)
        }))
        sys.exit(1)


if __name__ == '__main__':
    main()

