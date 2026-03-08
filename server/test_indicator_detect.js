const testLines = [
  '1*总蛋白（TP）',
  '74.0',
  '65.0-85.0',
  'g/L',
  '双缩脲法',
  '2前白蛋白（PA)',
  '331',
  '180-380',
  '30-120',      // Reference range - should NOT be new indicator
  '3ALP',        // Should be new indicator
  '15LP(a)',     // Should be new indicator
];

testLines.forEach(line => {
  const isNew = /^(\d{1,2})[\*\s]*([A-Z\u4e00-\u9fa5（\(][A-Za-z0-9\/\+\-\u4e00-\u9fa5（）\(\)]*)/.test(line) &&
                 !/^\d+[-\-]+\d/.test(line);
  console.log(line + ' -> ' + (isNew ? 'NEW INDICATOR' : 'continue'));
});
