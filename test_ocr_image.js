const fs = require('fs');
const { extractIndicatorsFromText } = require('./server/services/indicatorParserService.js');

// 读取测试图片
const imagePath = './testcase/image/1-250221105140404.jpg';

// 检查文件是否存在
if (!fs.existsSync(imagePath)) {
  console.log('Image not found:', imagePath);
  process.exit(1);
}

console.log('Testing OCR on real medical report image...');
console.log('Image path:', imagePath);

// 这里你需要调用实际的 OCR API
// 但 '../../
