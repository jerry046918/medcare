const lines = [
  '1*总蛋白（TP） 74.0 65.0-85.0 g/L 双缩脲法',
  '11谷丙/谷草（A/A） 0.75 计算值',
  '2前白蛋白（PA) 331 180-380 mg/L 免疫比浊法',
  '3*白蛋白（ALB） 46.9 40.0-55.0g/L 溴甲酚绿法',
];

// Pattern1: 序号*指标名(缩写) 数值 参考范围 单位 方法
const pattern1 = /^(\d+)\*?\s*(.+?)[（\(]([^）\)]+)[）\)]\s+([\d.]+)\s+([\d.]+[-~][\d.]+)\s*(.*)$/;

// Pattern6: 紧凑格式
const pattern6 = /^(\d+)([A-Z][A-Za-z0-9\/\+\-\(\)]*)([\u4e00-\u9fa5（（）\(\)\/A-Za-z]+)([\d.]+)([↑↓]?)((?:mmol|umol|μmol|g|mg|U|mIU|IU|mEq|pg|ng|fl|%|mm|cm)(?:ol)?(?:\/[A-Za-z]+)?)?\s*([\d.]+[-~\-]+[\d.]+)/;

console.log('Testing pattern1:');
lines.forEach((line, i) => {
  const match = line.match(pattern1);
  if (match) {
    console.log(`${i+1}. MATCH: ${match[2]} = ${match[4]} ${match[6] || ''}`);
  } else {
    console.log(`${i+1}. NO MATCH for pattern1`);
  }
});

console.log('\nTesting pattern6:');
lines.forEach((line, i) => {
  const processed = line.replace(/mmo1/gi, 'mmol');
  const match = processed.match(pattern6);
  if (match) {
    console.log(`${i+1}. MATCH: ${match[3]} = ${match[4]} ${match[6] || '(no unit)'}`);
  } else {
    console.log(`${i+1}. NO MATCH for pattern6`);
  }
});
