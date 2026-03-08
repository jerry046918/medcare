// Simulate test-1 OCR text structure
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
免疫比浊法`;

const lines = text.split('\n');
const mergedLines = [];
let currentBlock = [];

const isNewIndicator = (line) => {
  return /^(\d{1,2})[\*\s]*([A-Z\u4e00-\u9fa5（\(][A-Za-z0-9\/\+\-\u4e00-\u9fa5（）\(\)]*)/.test(line) &&
         !/^\d+[-\-]+\d/.test(line);
};

console.log('=== Preprocessing Trace ===\n');

for (let i = 0; i < lines.length; i++) {
  const line = lines[i].trim();
  if (!line) continue;
  
  const isNew = isNewIndicator(line);
  console.log(`Line ${i+1}: "${line}" -> ${isNew ? 'NEW INDICATOR' : 'continue'}`);
  
  if (isNew) {
    if (currentBlock.length > 0) {
      const merged = currentBlock.join('');
      console.log(`  -> Saving block: "${merged.substring(0, 60)}..."`);
      mergedLines.push(merged);
    }
    currentBlock = [line];
  } else if (currentBlock.length > 0) {
    if (currentBlock.length < 12) {
      console.log(`  -> Adding to current block`);
      currentBlock.push(line);
    }
  }
}
if (currentBlock.length > 0) {
  const merged = currentBlock.join('');
  console.log(`  -> Saving final block: "${merged.substring(0, 60)}..."`);
  mergedLines.push(merged);
}

console.log('\n=== Final Merged Lines ===');
mergedLines.forEach((line, i) => {
  console.log(`${i+1}. ${line}`);
});
