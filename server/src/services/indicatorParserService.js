/**
 * 指标解析服务
 * 从 OCR 识别的文本中解析医疗指标信息，并与指标库进行匹配
 */

const { MedicalIndicator, sequelize } = require('../models');
const { Op } = require('sequelize');

/**
 * 常见单位列表（按长度降序排列，确保长单位优先匹配）
 */
const KNOWN_UNITS = [
  '10^12/L', '10^9/L', 'mmol/L', 'umol/L', 'μmol/L', 'nmol/L', 'pmol/L',
  'mg/dL', 'mIU/L', 'ng/mL', 'pg/mL', 'mm/h', 'ug/L', 'μg/L', 'mg/L',
  'g/L', 'U/L', 'IU/L', 'mmol', 'nmol', 'pg', 'fl', 'um', '%'
];

/**
 * 常见实验方法名（用于从单位字段中剔除）
 */
const METHOD_KEYWORDS = [
  '速率法', '双缩脲法', '重氮法', '计算值', '免疫比浊法', '溴甲酚绿法',
  '苦味酸法', '循环酶法', '尿酸酶比色', '胶乳增强免', '比色法', '酶法',
  '脲酶速率法'
];

/**
 * 从混合文本中提取纯单位
 */
function extractUnit(text) {
  if (!text) return '';
  
  // 修正 OCR 常见错误（数字1被识别为字母l，或反过来）
  let normalized = text
    .replace(/umo1\/L/gi, 'umol/L')
    .replace(/umol1L/gi, 'umol/L')
    .replace(/mmo1\/L/gi, 'mmol/L')
    .replace(/mmol1L/gi, 'mmol/L')
    .replace(/μmo1\/L/gi, 'μmol/L')
    .replace(/μmol1L/gi, 'μmol/L');
  
  // 尝试匹配已知单位
  for (const unit of KNOWN_UNITS) {
    if (normalized.toLowerCase().includes(unit.toLowerCase())) {
      return unit;
    }
  }
  
  // 提取单位格式 (如 g/L, mg/L 等)
  const unitMatch = normalized.match(/([a-zA-Zμ]+\/[a-zA-Z]+)/);
  if (unitMatch) {
    return unitMatch[1];
  }
  
  // 提取简单单位
  const simpleUnitMatch = normalized.match(/^([a-zA-Zμ%]+)$/);
  if (simpleUnitMatch) {
    return simpleUnitMatch[1];
  }
  
  return '';
}

/**
 * 清理指标名称
 */
function cleanIndicatorName(name) {
  if (!name) return '';
  
  // 移除前导数字和星号（如 "11谷丙" -> "谷丙"）
  let cleaned = name.replace(/^\d+\*?\s*/, '');
  
  // 移除括号内的缩写（保留中文名）
  cleaned = cleaned.replace(/[（\(][^）\)]*[）\)]/g, '');
  
  // 移除空白
  cleaned = cleaned.replace(/\s+/g, '').trim();
  
  return cleaned;
}

/**
 * 参考范围解析
 */
function parseReferenceRange(rangeStr) {
  if (!rangeStr) return { min: null, max: null };

  // 处理各种分隔符（包括双连字符 --）
  const normalized = rangeStr.replace(/--/g, '-').replace(/[~到－—]/g, '-');
  const parts = normalized.split('-');

  if (parts.length === 2) {
    const min = parseFloat(parts[0].trim());
    const max = parseFloat(parts[1].trim());
    if (!isNaN(min) && !isNaN(max)) {
      return { min, max };
    }
  }

  // 尝试匹配 "小于X" 或 "大于X"
  const ltMatch = rangeStr.match(/[<＜]\s*([\d.]+)/);
  if (ltMatch) {
    return { min: 0, max: parseFloat(ltMatch[1]) };
  }

  const gtMatch = rangeStr.match(/[>＞]\s*([\d.]+)/);
  if (gtMatch) {
    return { min: parseFloat(gtMatch[1]), max: null };
  }

  return { min: null, max: null };
}

/**
 * 异常标记解析
 */
function parseAbnormalFlag(flag) {
  if (!flag) return null;

  const normalized = flag.trim();
  if (['↑', '+', '高', '偏高'].includes(normalized)) return 'high';
  if (['↓', '-', '低', '偏低'].includes(normalized)) return 'low';
  if (['异常', '阳性'].includes(normalized)) return 'abnormal';
  if (['阴性', '正常'].includes(normalized)) return 'normal';

  return null;
}

/**
 * 从 OCR 文本中提取指标数据
 * 支持医疗报告表格格式
 */
function extractIndicatorsFromText(text) {
  const lines = text.split('\n');
  const indicators = [];
  
  // 预处理：合并多行表格格式
  // 支持两种格式：
  // 1. 紧凑格式：序号+缩写+中文在同一行
  // 2. 多行格式：序号+缩写在一行，中文/数值/单位/范围在后续行
  const mergedLines = [];
  let currentBlock = [];
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    
    // 检测新的指标行（以数字开头）
    // 必须满足：序号(1-2位) + 字母或中文开头的内容
    // 排除参考范围格式如 "30-120" 或 "140--271"
    const isNewIndicator = /^(\d{1,2})[\*\s]*([A-Z\u4e00-\u9fa5（\(][A-Za-z0-9\/\+\-\u4e00-\u9fa5（）\(\)]*)/.test(line) &&
                           !/^\d+[\-\-]+\d/.test(line);  // 排除纯参考范围
    
    if (isNewIndicator) {
      if (currentBlock.length > 0) {
        mergedLines.push(currentBlock.join(' '));
      }
      currentBlock = [line];
    } else if (currentBlock.length > 0) {
      // 继续当前块（最多合并 10 行，适应多行格式）
      if (currentBlock.length < 12) {
        currentBlock.push(line);
      }
    }
  }
  if (currentBlock.length > 0) {
    mergedLines.push(currentBlock.join(' '));
  }
  // 从合并后的行中提取指标
  for (const line of mergedLines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.length < 5) continue;
    
    // 跳过非指标行
    if (/^(检验仪器|操作者|审核者|医院|科室|临床|报告|样本|备注|患者|No|结果|参考)/.test(trimmed)) {
      continue;
    }
    
    // 模式1: 序号*指标名(缩写) 数值 参考范围 单位 方法
    // 例如: 1*总蛋白（TP） 74.0 65.0-85.0 g/L 双缩脲法
    const pattern1 = /^(\d+)\*?\s*(.+?)[（\(]([^）\)]+)[）\)]\s+([\d.]+)\s+([\d.]+[-~][\d.]+)\s*(.*)$/;
    const match1 = trimmed.match(pattern1);
    
    if (match1) {
      const rawName = match1[2];
      const abbr = match1[3];
      const value = match1[4];
      const refRange = match1[5];
      const restText = match1[6] || '';
      
      // 清理名称
      const name = cleanIndicatorName(rawName);
      
      // 从剩余文本中提取单位和剔除方法
      const unit = extractUnit(restText);
      
      if (name && value && !isNaN(parseFloat(value)) && /[\u4e00-\u9fa5]/.test(name)) {
        const range = parseReferenceRange(refRange);
        indicators.push({
          rawText: trimmed,
          name,
          abbr,
          value,
          unit,
          referenceRange: refRange,
          normalMin: range.min,
          normalMax: range.max,
          abnormalFlag: null,
          abnormalType: null
        });
        continue;
      }
    }
    
    // 模式2: 序号*指标名(缩写) 数值 单位 参考范围 方法（单位在前）
    // 例如: 14胆碱酯酶（ChE） 9192 U/L 3930-10800 速率法
    const pattern2 = /^(\d+)\*?\s*(.+?)[（\(]([^）\)]+)[）\)]\s+([\d.]+)\s+(\S+)\s+([\d.]+[-~][\d.]+)\s*(.*)$/;
    const match2 = trimmed.match(pattern2);
    
    if (match2) {
      const rawName = match2[2];
      const abbr = match2[3];
      const value = match2[4];
      const unitPart = match2[5];
      const refRange = match2[6];
      
      // 检查 unitPart 是否是单位（而不是参考范围的开始）
      const isUnit = KNOWN_UNITS.some(u => unitPart.toLowerCase().includes(u.toLowerCase())) ||
                     /^[a-zA-Z\/]+$/.test(unitPart);
      
      if (isUnit) {
        const name = cleanIndicatorName(rawName);
        const unit = extractUnit(unitPart);
        
        if (name && value && !isNaN(parseFloat(value)) && /[\u4e00-\u9fa5]/.test(name)) {
          const range = parseReferenceRange(refRange);
          indicators.push({
            rawText: trimmed,
            name,
            abbr,
            value,
            unit,
            referenceRange: refRange,
            normalMin: range.min,
            normalMax: range.max,
            abnormalFlag: null,
            abnormalType: null
          });
          continue;
        }
      }
    }
    
    // 模式3: 序号*指标名(缩写) 数值 方法（无参考范围，计算值）
    // 例如: 11谷丙/谷草（A/A） 0.75 计算值
    const pattern3 = /^(\d+)\*?\s*(.+?)[（\(]([^）\)]+)[）\)]\s+([\d.]+)\s+(\S+)$/;
    const match3 = trimmed.match(pattern3);
    
    if (match3) {
      const rawName = match3[2];
      const abbr = match3[3];
      const value = match3[4];
      const lastPart = match3[5];
      
      // 如果最后一部分是方法名，说明是计算值
      const isMethod = METHOD_KEYWORDS.some(m => lastPart.includes(m));
      
      if (isMethod) {
        const name = cleanIndicatorName(rawName);
        
        if (name && value && !isNaN(parseFloat(value)) && /[\u4e00-\u9fa5]/.test(name)) {
          indicators.push({
            rawText: trimmed,
            name,
            abbr,
            value,
            unit: '',
            referenceRange: null,
            normalMin: null,
            normalMax: null,
            abnormalFlag: null,
            abnormalType: null
          });
          continue;
        }
      }
    }
    
    // 模式4: 带单位的参考范围（单位附加在范围后）
    // 例如: 3*白蛋白（ALB） 46.9 40.0-55.0g/L 溴甲酚绿法
    const pattern4 = /^(\d+)\*?\s*(.+?)[（\(]([^）\)]+)[）\)]\s+([\d.]+)\s+([\d.]+[-~][\d.]+)([a-zA-Z\/]+)\s*(.*)$/;
    const match4 = trimmed.match(pattern4);
    
    if (match4) {
      const rawName = match4[2];
      const abbr = match4[3];
      const value = match4[4];
      const refRange = match4[5];
      const unitPart = match4[6];
      
      const name = cleanIndicatorName(rawName);
      const unit = extractUnit(unitPart);
      
      if (name && value && !isNaN(parseFloat(value)) && /[\u4e00-\u9fa5]/.test(name)) {
        const range = parseReferenceRange(refRange);
        indicators.push({
          rawText: trimmed,
          name,
          abbr,
          value,
          unit,
          referenceRange: refRange,
          normalMin: range.min,
          normalMax: range.max,
          abnormalFlag: null,
          abnormalType: null
        });
        continue;
      }
    }
    
    // 模式5: 特殊格式 - 指标名和数值在同一行（无括号缩写）
    // 例如: 19胱抑素C（CystatinC）0.85 0.55-1.05 mg/L
    const pattern5 = /^(\d+)\*?\s*(.+?)[（\(]([^）\)]+)[）\)]([\d.]+)\s+([\d.]+[-~][\d.]+)\s+(.*)$/;
    const match5 = trimmed.match(pattern5);
    
    if (match5) {
      const rawName = match5[2];
      const abbr = match5[3];
      const value = match5[4];
      const refRange = match5[5];
      const restText = match5[6];
      
      const name = cleanIndicatorName(rawName);
      const unit = extractUnit(restText);
      
      if (name && value && !isNaN(parseFloat(value)) && /[\u4e00-\u9fa5]/.test(name)) {
        const range = parseReferenceRange(refRange);
        indicators.push({
          rawText: trimmed,
          name,
          abbr,
          value,
          unit,
          referenceRange: refRange,
          normalMin: range.min,
          normalMax: range.max,
          abnormalFlag: null,
        });
        continue;
      }
    }
    
    // 模式6: 紧凑格式 - 序号+缩写+中文名+数值[异常标记]+单位+参考范围
    // 例如: 1ALT丙氨酸氨基转移酶58.7↑U/L9.0--50.0
    // 例如: 22Cr肌酐82.7μmol/L44.0--133.0
    // 例如: 19A/G白球比1.91.2--2.4（无单位）
    // 双列布局：可能在一行中有多个指标连在一起
    
    // 预处理：修正 OCR 常见错误
    let processedLine = trimmed
      .replace(/mmo1\/L/gi, 'mmol/L')
      .replace(/mmo1L/gi, 'mmol/L')
      .replace(/umol1L/gi, 'umol/L')
      .replace(/μmo1\/L/gi, 'μmol/L')
      .replace(/μmol1L/gi, 'μmol/L');
    
    // 更宽松的模式：单位可选，支持无单位的指标， 支持可选空格
    // 组1: 序号, 组2: 缩写(可含括号), 组3: 中文名(可含英文和括号), 组4: 数值, 组5: 异常标记, 组6: 单位(可选含/L), 组7: 参考范围
    const pattern6 = /^(\d+)\s*([A-Z][A-Za-z0-9\/\+\-\(\)]*)\s*([\u4e00-\u9fa5（（）\(\)\/A-Za-z]+)\s*([\d.]+)\s*([↑↓]?)\s*((?:mmol|umol|μmol|g|mg|U|mIU|IU|mEq|pg|ng|fl|%|mm|cm)(?:ol)?(?:\/[A-Za-z]+)?)?\s*([\d.]+[-~\-]+[\d.]+)/;
    
    let remainingText = processedLine;
    let foundInLine = true;
    
    while (foundInLine) {
      foundInLine = false;
      const match6 = remainingText.match(pattern6);
      
      if (match6) {
        const abbr = match6[2];
        const rawName = match6[3];
        let value = match6[4];
        const abnormalFlag = match6[5];
        const unitPart = match6[6] || '';
        let rawRefRange = match6[7];
        
        // 智能分割数值和参考范围（处理 OCR 合并情况）
        // 例如: "1.91.2" -> value="1.9", refRange="1.2--..."
        // 检测模式: 数值中有两个小数点，第二个小数点后跟着参考范围分隔符
        const valueParts = value.split('.');
        if (valueParts.length > 2) {
          // 有多个小数点，可能是数值和参考范围最小值合并
          // 医疗数值通常只有1位小数
          const possibleValue = valueParts[0] + '.' + valueParts[1][0];
          const possibleRefMin = valueParts[1].substring(1) + '.' + valueParts.slice(2).join('.');
          
          // 验证: 如果剩余部分看起来像参考范围开始，则分割
          if (possibleRefMin && /^[\d.]+$/.test(possibleRefMin)) {
            value = possibleValue;
            rawRefRange = possibleRefMin + rawRefRange;
          }
        }
        
        // 后处理参考范围：医疗报告通常最多1位小数
        // 如果被下一个指标序号'污染'，需要截断
        const refRangeMatch = rawRefRange.match(/^([\d.]+)([-~\-]+)([\d.]+)$/);
        let cleanRefRange = rawRefRange;
        let extraChars = 0;
        
        if (refRangeMatch) {
          const min = refRangeMatch[1];
          const sep = refRangeMatch[2];
          let max = refRangeMatch[3];
          
          // 如果max部分有超过1位小数，可能被下一个序号污染
          if (max.includes('.')) {
            const parts = max.split('.');
            if (parts[1] && parts[1].length > 1) {
              extraChars = parts[1].length - 1;
              max = parts[0] + '.' + parts[1][0]; // 只保留1位小数
            }
          }
          cleanRefRange = min + sep + max;
        }
        
        const name = cleanIndicatorName(rawName);
        const unit = extractUnit(unitPart);
        
        if (name && value && !isNaN(parseFloat(value)) && /[\u4e00-\u9fa5]/.test(name)) {
          const range = parseReferenceRange(cleanRefRange);
          const abnormalType = parseAbnormalFlag(abnormalFlag);
          
          // 计算实际的匹配长度（排除被污染的部分）
          const actualMatchLength = match6[0].length - extraChars;
          
          indicators.push({
            rawText: match6[0].slice(0, actualMatchLength),
            name,
            abbr,
            value,
            unit,
            referenceRange: cleanRefRange,
            normalMin: range.min,
            normalMax: range.max,
            abnormalFlag,
            abnormalType
          });
          
          // 从行中移除已匹配的部分，继续匹配剩余内容
          remainingText = remainingText.slice(actualMatchLength);
          foundInLine = true;
        }
      }
    }
  }

  return indicators;
}

/**
 * 计算 Levenshtein 距离（编辑距离）
 * 用于模糊匹配指标名称
 */
function levenshteinDistance(str1, str2) {
  const m = str1.length;
  const n = str2.length;
  
  // 创建 DP 表
  const dp = Array(m + 1).fill(null).map(() => Array(n + 1).fill(0));
  
  // 初始化
  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;
  
  // 填充 DP 表
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (str1[i - 1] === str2[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1];
      } else {
        dp[i][j] = Math.min(
          dp[i - 1][j] + 1,     // 删除
          dp[i][j - 1] + 1,     // 插入
          dp[i - 1][j - 1] + 1  // 替换
        );
      }
    }
  }
  
  return dp[m][n];
}

/**
 * 计算两个字符串的相似度（0-1）
 */
function similarity(str1, str2) {
  const maxLen = Math.max(str1.length, str2.length);
  if (maxLen === 0) return 1;
  const distance = levenshteinDistance(str1, str2);
  return 1 - distance / maxLen;
}

/**
 * 标准化指标名称（用于匹配）
 */
function normalizeName(name) {
  if (!name) return '';
  return name
    .toLowerCase()
    .replace(/[\s\-_（）\(\)\/\\]/g, '') // 移除空格、连字符、括号、斜杠等
    .replace(/计数$/g, '')  // 移除后缀"计数"
    .replace(/浓度$/g, '')  // 移除后缀"浓度"
    .replace(/数$/g, '');   // 移除后缀"数"
}

/**
 * 智能匹配指标名称
 * 支持多级匹配：精确匹配 -> 别名匹配 -> 包含匹配 -> 模糊匹配
 */
async function matchIndicator(extractedName) {
  if (!extractedName) return null;

  // 清理名称
  const cleanName = extractedName.trim();
  const normalizedExtracted = normalizeName(cleanName);

  // 获取所有指标（包括别名）
  const allIndicators = await MedicalIndicator.findAll();

  // 1. 精确匹配 name
  let match = allIndicators.find(ind => ind.name === cleanName);
  if (match) return match;

  // 2. 精确匹配数据库中的别名
  for (const ind of allIndicators) {
    const aliases = ind.aliases || [];
    if (aliases.includes(cleanName)) {
      return ind;
    }
  }

  // 3. 标准化后的精确匹配
  match = allIndicators.find(ind => normalizeName(ind.name) === normalizedExtracted);
  if (match) return match;

  // 4. 标准化后的别名匹配
  for (const ind of allIndicators) {
    const aliases = ind.aliases || [];
    if (aliases.some(alias => normalizeName(alias) === normalizedExtracted)) {
      return ind;
    }
  }

  // 5. 包含匹配（指标库中的名称包含提取的名称，或反之）
  match = allIndicators.find(ind => {
    const normalizedName = normalizeName(ind.name);
    return normalizedName.includes(normalizedExtracted) || 
           normalizedExtracted.includes(normalizedName);
  });
  if (match) return match;

  // 6. 别名包含匹配
  for (const ind of allIndicators) {
    const aliases = ind.aliases || [];
    if (aliases.some(alias => {
      const normalizedAlias = normalizeName(alias);
      return normalizedAlias.includes(normalizedExtracted) || 
             normalizedExtracted.includes(normalizedAlias);
    })) {
      return ind;
    }
  }

  // 7. 使用硬编码别名映射（后备）
  const aliasMap = {
    '白细胞': ['白细胞计数', 'WBC', '白细胞数'],
    '红细胞': ['红细胞计数', 'RBC', '红细胞数'],
    '血红蛋白': ['HGB', '血红蛋白浓度', 'Hb'],
    '血小板': ['血小板计数', 'PLT', '血小板数'],
    '血糖': ['空腹血糖', 'Glu', '葡萄糖'],
    '尿酸': ['UA', '尿酸浓度'],
    '肌酐': ['Cr', '血肌酐'],
    '尿素氮': ['BUN'],
    '谷丙转氨酶': ['ALT', '丙氨酸氨基转移酶'],
    '谷草转氨酶': ['AST', '天门冬氨酸氨基转移酶'],
    '总胆固醇': ['TC', '胆固醇'],
    '甘油三酯': ['TG'],
    '高密度脂蛋白': ['HDL-C', 'HDL'],
    '低密度脂蛋白': ['LDL-C', 'LDL'],
    '总蛋白': ['TP'],
    '白蛋白': ['ALB'],
    '球蛋白': ['GLB'],
    '前白蛋白': ['PA'],
    '总胆红素': ['TBIL'],
    '直接胆红素': ['DBIL'],
    '间接胆红素': ['IBIL'],
    '谷氨酰转肽酶': ['GGT'],
    '碱性磷酸酶': ['ALP'],
    '总胆汁酸': ['TBA'],
    '胆碱酯酶': ['ChE'],
    '胱抑素C': ['CystatinC', 'Cystatin C'],
    '谷丙/谷草': ['A/A', '谷丙谷草比值', 'AST/ALT'],
    '白球比例': ['A/G', '白球比'],
    '尿素氮/肌酐': ['B/C', 'BUN/Cr']
  };

  for (const [standardName, aliases] of Object.entries(aliasMap)) {
    const allNames = [standardName, ...aliases];
    if (allNames.some(name => 
      normalizeName(name) === normalizedExtracted ||
      normalizeName(name).includes(normalizedExtracted) ||
      normalizedExtracted.includes(normalizeName(name))
    )) {
      match = allIndicators.find(ind => 
        normalizeName(ind.name).includes(normalizeName(standardName)) ||
        normalizeName(standardName).includes(normalizeName(ind.name))
      );
      if (match) return match;
    }
  }

  // 8. 模糊匹配（Levenshtein 距离）- 相似度阈值 0.7
  const SIMILARITY_THRESHOLD = 0.7;
  let bestMatch = null;
  let bestSimilarity = 0;

  for (const ind of allIndicators) {
    // 匹配名称
    const nameSim = similarity(normalizeName(ind.name), normalizedExtracted);
    if (nameSim > bestSimilarity && nameSim >= SIMILARITY_THRESHOLD) {
      bestSimilarity = nameSim;
      bestMatch = ind;
    }

    // 匹配别名
    const aliases = ind.aliases || [];
    for (const alias of aliases) {
      const aliasSim = similarity(normalizeName(alias), normalizedExtracted);
      if (aliasSim > bestSimilarity && aliasSim >= SIMILARITY_THRESHOLD) {
        bestSimilarity = aliasSim;
        bestMatch = ind;
      }
    }
  }

  if (bestMatch) {
    console.log(`[OCR] 模糊匹配成功: "${cleanName}" -> "${bestMatch.name}" (相似度: ${(bestSimilarity * 100).toFixed(1)}%)`);
    return bestMatch;
  }

  return null;
}

/**
 * 处理 OCR 结果，提取并匹配指标
 * 使用基于指标库的智能解析
 */
async function processOCRResult(ocrResult) {
  // 预加载所有指标（用于智能解析）
  const allIndicators = await MedicalIndicator.findAll();

  // 使用基于指标库的智能解析
  const extractedIndicators = await extractIndicatorsWithKnowledgeBase(ocrResult.text, allIndicators);

  // 处理结果
  const results = [];

  for (const extracted of extractedIndicators) {
    let matchedIndicator = null;

    // 如果在解析阶段已经匹配到指标，直接使用
    if (extracted.matchedIndicatorId && extracted.matchedIndicatorName) {
      matchedIndicator = allIndicators.find(ind => ind.id === extracted.matchedIndicatorId);
    } else {
      // 否则使用传统的匹配函数
      matchedIndicator = await matchIndicator(extracted.name);
    }

    const result = {
      extracted: {
        name: extracted.name,
        value: extracted.value,
        unit: extracted.unit,
        referenceRange: extracted.referenceRange,
        normalMin: extracted.normalMin,
        normalMax: extracted.normalMax,
        abnormalFlag: extracted.abnormalFlag,
        abnormalType: extracted.abnormalType,
        rawText: extracted.rawText,
        // 如果有纠正的名称，记录下来
        correctedFrom: extracted.correctedName || null
      },
      matched: matchedIndicator ? {
        id: matchedIndicator.id,
        name: matchedIndicator.name,
        unit: matchedIndicator.unit,
        type: matchedIndicator.type,
        valueType: matchedIndicator.valueType,
        normalMin: matchedIndicator.normalMin,
        normalMax: matchedIndicator.normalMax,
        referenceRange: matchedIndicator.referenceRange
      } : null,
      // 如果匹配成功，准备用于保存的数据
      // 【重要】referenceRange 和 isNormal/abnormalType 以指标库为准
      // OCR 识别的范围和异常标记放入 notes 字段
      indicatorData: matchedIndicator ? {
        indicatorId: matchedIndicator.id,
        value: extracted.value,
        // 参考范围：以指标库为准（不再使用 OCR 识别的范围）
        referenceRange: matchedIndicator.referenceRange,
        // 是否正常：根据指标库的范围计算（不再依赖 OCR 标记）
        isNormal: calculateIsNormalFromLibrary(extracted.value, matchedIndicator),
        // 异常类型：根据指标库的范围计算
        abnormalType: calculateAbnormalTypeFromLibrary(extracted.value, matchedIndicator),
        // 备注字段：包含 OCR 识别的范围和异常标记
        notes: buildOCRNotes(extracted)
      } : null,
      // 记录解析置信度
      confidence: extracted.confidence || null
    };

    results.push(result);
  }

  return {
    total: results.length,
    matched: results.filter(r => r.matched).length,
    unmatched: results.filter(r => !r.matched).length,
    indicators: results
  };
}

/**
 * 根据指标库计算是否正常
 * 【重要】不再依赖 OCR 识别的范围/标记，完全以指标库为准
 */
function calculateIsNormalFromLibrary(value, indicator) {
  const numValue = parseFloat(value);
  if (isNaN(numValue)) return null;

  // 数值型指标：使用指标库的 normalMin 和 normalMax
  if (indicator.valueType === 'numeric' && indicator.normalMin !== null && indicator.normalMax !== null) {
    return numValue >= indicator.normalMin && numValue <= indicator.normalMax;
  }

  // 定性指标：使用指标库的 normalValue
  if (indicator.valueType === 'qualitative' && indicator.normalValue) {
    return value === indicator.normalValue;
  }

  return null;
}

/**
 * 根据指标库计算异常类型
 * 【重要】不再依赖 OCR 识别的标记，完全以指标库为准
 */
function calculateAbnormalTypeFromLibrary(value, indicator) {
  const numValue = parseFloat(value);
  if (isNaN(numValue)) return null;

  // 数值型指标
  if (indicator.valueType === 'numeric' && indicator.normalMin !== null && indicator.normalMax !== null) {
    if (numValue < indicator.normalMin) return 'low';
    if (numValue > indicator.normalMax) return 'high';
    return 'normal';
  }

  // 定性指标
  if (indicator.valueType === 'qualitative' && indicator.normalValue) {
    return value === indicator.normalValue ? 'normal' : 'abnormal';
  }

  return null;
}

/**
 * 构建 OCR 备注信息
 * 将 OCR 识别的范围、异常标记等信息放入备注字段
 */
function buildOCRNotes(extracted) {
  const notes = [];
  
  // OCR 识别的参考范围
  if (extracted.referenceRange) {
    notes.push(`报告范围: ${extracted.referenceRange}`);
  }
  
  // OCR 识别的异常标记
  if (extracted.abnormalFlag) {
    const flagMeaning = {
      '↑': '偏高',
      '↓': '偏低',
      '+': '阳性',
      '-': '阴性'
    };
    const meaning = flagMeaning[extracted.abnormalFlag] || extracted.abnormalFlag;
    notes.push(`报告标记: ${extracted.abnormalFlag} (${meaning})`);
  }
  
  // OCR 识别的单位（如果有的话）
  if (extracted.unit) {
    notes.push(`单位: ${extracted.unit}`);
  }
  
  return notes.length > 0 ? notes.join('; ') : null;
}

/**
 * 创建新指标（用户确认后）
 */
async function createIndicatorFromExtracted(extracted, type = '血液') {
  const indicator = await MedicalIndicator.create({
    name: extracted.name,
    unit: extracted.unit || '',
    type: type,
    valueType: 'numeric',
    normalMin: extracted.normalMin,
    normalMax: extracted.normalMax,
    referenceRange: extracted.referenceRange,
    description: `从 OCR 识别自动创建 - 原始文本: ${extracted.rawText}`,
    isDefault: false
  });

  return indicator;
}

/**
 * 基于指标库的智能解析函数
 * 
 * 在解析阶段就利用指标库中的名称和别名，提高识别成功率
 * 支持模糊匹配来纠正 OCR 错误
 * 
 * @param {string} text - OCR 识别的原始文本
 * @param {Array} allIndicators - 所有指标（包含 name 和 aliases）
 * @returns {Array} 提取的指标列表
 */
async function extractIndicatorsWithKnowledgeBase(text, allIndicators = null) {
  // 如果没有传入指标库，则从数据库加载
  if (!allIndicators) {
    allIndicators = await MedicalIndicator.findAll();
  }

  // 构建指标名称索引（包含别名）
  const indicatorIndex = buildIndicatorIndex(allIndicators);

  // 首先尝试基于指标库的解析
  const knowledgeBasedResults = extractUsingKnowledgeBase(text, indicatorIndex);

  // 然后使用传统正则解析（作为后备）
  const regexResults = extractIndicatorsFromText(text);

  // 合并结果：优先使用基于指标库的解析
  const mergedResults = mergeResults(knowledgeBasedResults, regexResults, indicatorIndex);

  return mergedResults;
}

/**
 * 构建指标索引
 */
function buildIndicatorIndex(indicators) {
  const index = {
    byName: new Map(),       // 名称 -> 指标
    byAlias: new Map(),      // 别名 -> 指标
    allNames: [],            // 所有名称（用于模糊匹配）
    normalizedMap: new Map() // 标准化名称 -> 原始名称
  };

  for (const ind of indicators) {
    // 添加主名称
    index.byName.set(ind.name, ind);
    index.allNames.push(ind.name);
    index.normalizedMap.set(normalizeName(ind.name), ind.name);

    // 添加别名
    const aliases = ind.aliases || [];
    for (const alias of aliases) {
      index.byAlias.set(alias, ind);
      index.allNames.push(alias);
      index.normalizedMap.set(normalizeName(alias), alias);
    }
  }

  return index;
}

/**
 * 使用指标库进行智能解析
 */
function extractUsingKnowledgeBase(text, indicatorIndex) {
  const lines = text.split('\n');
  const results = [];
  const usedIndicators = new Set(); // 避免重复匹配同一指标

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.length < 5) continue;

    // 跳过非指标行
    if (/^(检验仪器|操作者|审核者|医院|科室|临床|报告|样本|备注|患者|No|结果|参考)/.test(trimmed)) {
      continue;
    }

    // 尝试在行中找到指标名称
    const found = findIndicatorInLine(trimmed, indicatorIndex, usedIndicators);

    if (found) {
      // 从找到的位置提取数值信息
      const extracted = extractValuesAfterName(trimmed, found);
      if (extracted) {
        results.push({
          ...extracted,
          matchedIndicatorId: found.indicator.id,
          matchedIndicatorName: found.indicator.name,
          confidence: found.confidence
        });
        usedIndicators.add(found.indicator.id);
      }
    }
  }

  return results;
}

/**
 * 在行中查找指标名称
 */
function findIndicatorInLine(line, indicatorIndex, usedIndicators) {
  // 移除序号前缀
  let cleanLine = line.replace(/^\d+[\*\s]*/, '');

  // 1. 精确匹配：遍历所有已知名称
  for (const name of indicatorIndex.allNames) {
    const pos = cleanLine.indexOf(name);
    if (pos !== -1) {
      const indicator = indicatorIndex.byName.get(name) || indicatorIndex.byAlias.get(name);
      if (indicator && !usedIndicators.has(indicator.id)) {
        return {
          name,
          indicator,
          position: pos,
          confidence: 1.0
        };
      }
    }
  }

  // 2. 模糊匹配：处理 OCR 错误
  // 提取可能的指标名称（中文开头的连续字符）
  const possibleNameMatch = cleanLine.match(/^([A-Za-z\/]+)?([\u4e00-\u9fa5（）\(\)\/]+)/);
  if (possibleNameMatch) {
    const possibleName = possibleNameMatch[2];
    const normalized = normalizeName(possibleName);

    // 在索引中查找相似的名称
    let bestMatch = null;
    let bestSimilarity = 0;
    const SIMILARITY_THRESHOLD = 0.75; // 稍微降低阈值以适应 OCR 错误

    for (const [normalizedKey, originalName] of indicatorIndex.normalizedMap) {
      const sim = similarity(normalized, normalizedKey);
      if (sim > bestSimilarity && sim >= SIMILARITY_THRESHOLD) {
        bestSimilarity = sim;
        const indicator = indicatorIndex.byName.get(originalName) || indicatorIndex.byAlias.get(originalName);
        if (indicator && !usedIndicators.has(indicator.id)) {
          bestMatch = {
            name: originalName,
            indicator,
            position: possibleNameMatch.index,
            confidence: sim,
            correctedFrom: possibleName // 记录原始识别的名称
          };
        }
      }
    }

    if (bestMatch) {
      return bestMatch;
    }
  }

  // 3. 尝试匹配缩写形式（如 ALT, AST 等）
  const abbrMatch = cleanLine.match(/^([A-Z][A-Z0-9\/\+\-]+)/);
  if (abbrMatch) {
    const abbr = abbrMatch[1];
    const indicator = indicatorIndex.byAlias.get(abbr);
    if (indicator && !usedIndicators.has(indicator.id)) {
      return {
        name: abbr,
        indicator,
        position: 0,
        confidence: 0.9
      };
    }
  }

  return null;
}

/**
 * 从指标名称后提取数值信息
 */
function extractValuesAfterName(line, found) {
  // 移除序号前缀
  let cleanLine = line.replace(/^\d+[\*\s]*/, '');

  // 找到指标名称的位置
  const namePos = cleanLine.indexOf(found.name);
  if (namePos === -1 && !found.correctedFrom) {
    return null;
  }

  // 获取指标名称后的文本
  const afterName = cleanLine.substring(namePos + (found.name.length || found.correctedFrom?.length || 0));

  // 提取数值、单位、参考范围
  // 常见格式：数值 [异常标记] [单位] [参考范围]
  // 例如: "74.0 65.0-85.0 g/L" 或 "58.7↑U/L9.0--50.0"
  
  // 修正 OCR 错误
  const normalized = afterName
    .replace(/umo1\/L/gi, 'umol/L')
    .replace(/mmo1\/L/gi, 'mmol/L')
    .replace(/--/g, '-');

  // 提取数值（第一个数字）
  const valueMatch = normalized.match(/([\d.]+)/);
  if (!valueMatch) {
    return null;
  }
  const value = valueMatch[1];

  // 提取异常标记
  let abnormalFlag = null;
  const flagMatch = normalized.match(/[↑↓]/);
  if (flagMatch) {
    abnormalFlag = flagMatch[0];
  }

  // 提取单位
  const unit = extractUnit(normalized);

  // 提取参考范围
  const rangeMatch = normalized.match(/([\d.]+)\s*[-~]+\s*([\d.]+)/);
  let referenceRange = null;
  let normalMin = null;
  let normalMax = null;

  if (rangeMatch) {
    referenceRange = `${rangeMatch[1]}-${rangeMatch[2]}`;
    normalMin = parseFloat(rangeMatch[1]);
    normalMax = parseFloat(rangeMatch[2]);
  }

  return {
    rawText: line,
    name: found.correctedFrom || found.name, // 使用原始识别的名称
    correctedName: found.correctedFrom ? found.name : null, // 如果有纠正，记录标准名称
    value,
    unit,
    referenceRange,
    normalMin,
    normalMax,
    abnormalFlag,
    abnormalType: parseAbnormalFlag(abnormalFlag)
  };
}

/**
 * 合并两种解析结果
 */
function mergeResults(knowledgeResults, regexResults, indicatorIndex) {
  const merged = [...knowledgeResults];
  const usedIndicatorIds = new Set(knowledgeResults.map(r => r.matchedIndicatorId));

  // 添加正则解析的结果（排除已匹配的）
  for (const regexResult of regexResults) {
    // 检查是否已经被基于指标库的解析匹配
    const normalized = normalizeName(regexResult.name);
    
    // 尝试找到对应的指标
    let alreadyMatched = false;
    for (const [normKey, origName] of indicatorIndex.normalizedMap) {
      if (normKey === normalized || normKey.includes(normalized) || normalized.includes(normKey)) {
        const indicator = indicatorIndex.byName.get(origName) || indicatorIndex.byAlias.get(origName);
        if (indicator && usedIndicatorIds.has(indicator.id)) {
          alreadyMatched = true;
          break;
        }
      }
    }

    if (!alreadyMatched) {
      merged.push(regexResult);
    }
  }

  return merged;
}

module.exports = {
  extractIndicatorsFromText,
  matchIndicator,
  processOCRResult,
  createIndicatorFromExtracted,
  parseReferenceRange,
  parseAbnormalFlag,
  extractIndicatorsWithKnowledgeBase,
  // 导出辅助函数供测试
  buildIndicatorIndex,
  findIndicatorInLine,
  extractValuesAfterName
};
