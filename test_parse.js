const { extractIndicatorsFromText } = require('./server/services/indicatorParserService');

const line = '1*总蛋白（TP） 74.0 65.0-85.0 g/L';
console.log('Testing line:', line);

// 模式1 测试
const match1 = line.match(/^(\d+)\*?\s*(.+?)[（\(]([^)）]+)?[）\)]?\s*([\d.]+)\s+([\d.]+[-~][\d.]+)\s*(.*)$/);
console.log('match1 result:', match1);

// 更简单的模式
const match2 = line.match(/^(\d+)\*?\s*(.+?)\s+([\d.]+)\s+([\d.]+[-~][\d.]+)/);
console.log('match2 result:', match2);

// 提取指标
const indicators = extractIndicatorsFromText(line);
console.log('Extracted:', indicators.length);
console.log(JSON.stringify(indicators, null, 2));
