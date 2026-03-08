const testLines = [
  '11谷丙/谷草（A/A）\n0.75计算值\n2前白蛋白（PA)331180-380mg/L免疫比浊法',
  '2前白蛋白（PA)',
  '计算值',
];

const isNewIndicator = (line) => {
  return /^(\d{1,2})[\*\s]*([A-Z\u4e00-\u9fa5（\(][A-Za-z0-9\/\+\-\u4e00-\u9fa5（）\(\)]*)/.test(line) &&
         !/^\d+[-\-]+\d/.test(line);
};

testLines.forEach(line => {
  console.log(`"${line.substring(0, 30)}..." -> ${isNewIndicator(line) ? 'NEW' : 'continue'}`);
});

// The issue: when we have embedded newlines, the regex doesn't match
// because \n is in the middle of the string
console.log('\nChecking if regex works with embedded newlines:');
const lineWithEmbedded = '11谷丙/谷草（A/A）\n0.75计算值\n2前白蛋白（PA)';
console.log(`Full line: ${isNewIndicator(lineWithEmbedded) ? 'NEW' : 'continue'}`);

// But if we split by \n first:
const parts = lineWithEmbedded.split('\n');
console.log('\nSplit parts:');
parts.forEach((part, i) => {
  console.log(`${i+1}. "${part}" -> ${isNewIndicator(part) ? 'NEW' : 'continue'}`);
});
