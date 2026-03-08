const lines = [
  '1*总蛋白（TP） 74.0 65.0-85.0 g/L 双缩脲法',
  '11谷丙/谷草（A/A） 0.75 计算值',
  '2前白蛋白（PA) 331 180-380 mg/L 免疫比浊法',
  '3*白蛋白（ALB） 46.9 40.0-55.0g/L 溴甲酚绿法',
];

// Pattern3: computed values (no reference range)
const pattern3 = /^(\d+)\*?\s*(.+?)[（\(]([^）\)]+)[）\)]\s+([\d.]+)\s+(\S+)$/;

const METHOD_KEYWORDS = [
  '速率法', '双缩脲法', '重氮法', '计算值', '免疫比浊法', '溴甲酚绿法',
  '苦味酸法', '循环酶法', '尿酸酶比色', '胶乳增强免', '比色法', '酶法',
  '脲酶速率法'
];

console.log('Testing pattern3 for line 2:');
const match = lines[1].match(pattern3);
if (match) {
  console.log('MATCH:', match[2], '=', match[4], 'method:', match[5]);
  const isMethod = METHOD_KEYWORDS.some(m => match[5].includes(m));
  console.log('Is method:', isMethod);
} else {
  console.log('NO MATCH');
}
