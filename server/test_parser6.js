const lines = [
  '1ALT丙氨酸氨基转移酶58.7↑U/L9.0--50.0',
  '19A/G白球比1.91.2--2.4',
  '2AST天门冬氨酸氨基转移酶32.8U/L15.0--40.0',
  '3ALP碱性磷酸酶103U/L30-120',
  '5LDH乳酸脱氢酶167U/L140--271',
  '6CK肌酸激酶93U/L0-171',
  '15LP(a)脂蛋白（a)787↑mg/L0--300',
  '31CYSC胱抑素C1.01mg/L0.63-1.25',
  '7HBDHa-羟丁酸脱氢酶122U/L90--180',
];

function preprocess(line) {
  return line.replace(/mmo1/gi, 'mmol');
}

// Allow letters anywhere in name
const pattern6 = /^(\d+)([A-Z][A-Za-z0-9\/\+\-\(\)]*)([\u4e00-\u9fa5（（）\(\)\/A-Za-z]+)([\d.]+)([↑↓]?)((?:mmol|umol|μmol|g|mg|U|mIU|IU|mEq|pg|ng|fl|%|mm|cm)(?:ol)?(?:\/[A-Za-z]+)?)?\s*([\d.]+[-~\-]+[\d.]+)/;

console.log('Testing with letters anywhere in name:\n');

lines.forEach((line, i) => {
  const processed = preprocess(line);
  const match = processed.match(pattern6);
  if (match) {
    let value = match[4];
    let refRange = match[7];
    
    const valueParts = value.split('.');
    if (valueParts.length > 2) {
      const possibleValue = valueParts[0] + '.' + valueParts[1][0];
      const possibleRefMin = valueParts[1].substring(1) + '.' + valueParts.slice(2).join('.');
      if (possibleRefMin && /^[\d.]+$/.test(possibleRefMin)) {
        value = possibleValue;
        refRange = possibleRefMin + refRange;
      }
    }
    
    console.log(`${i+1}. ${match[3]} = ${value} ${match[6] || '(no unit)'} ref=${refRange}`);
  } else {
    console.log(`${i+1}. NO MATCH: ${processed}`);
  }
});
