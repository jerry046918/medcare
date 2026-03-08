const text = `1*总蛋白（TP）
74.0
65.0-85.0
g/L
双缩脲法
11谷丙/谷草（A/A）
0.75
计算值
2前白蛋白（PA)
331
180-380
mg/L
免疫比浊法
3*白蛋白（ALB）
46.9
40.0-55.0g/L
溴甲酚绿法`;

const lines = text.split('\n');
const mergedLines = [];
let currentBlock = [];

for (let i = 0; i < lines.length; i++) {
  const line = lines[i].trim();
  if (!line) continue;
  
  const isNewIndicator = /^(\d{1,2})[\*\s]*([A-Z\u4e00-\u9fa5（\(][A-Za-z0-9\/\+\-\u4e00-\u9fa5（）\(\)]*)/.test(line) &&
                         !/^\d+[-\-]+\d/.test(line);
  
  if (isNewIndicator) {
    if (currentBlock.length > 0) {
      mergedLines.push(currentBlock.join(' '));
    }
    currentBlock = [line];
  } else if (currentBlock.length > 0) {
    if (currentBlock.length < 12) {
      currentBlock.push(line);
    }
  }
}
if (currentBlock.length > 0) {
  mergedLines.push(currentBlock.join(' '));
}

console.log('=== Merged Lines ===');
mergedLines.forEach((line, i) => {
  console.log((i+1) + '. ' + line);
});
