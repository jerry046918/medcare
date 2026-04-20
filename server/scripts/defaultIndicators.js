/**
 * 默认医疗指标数据
 * 包含常见慢性病（糖尿病、高血压、高尿酸血症、心脑血管疾病等）的主要监测指标
 */

const defaultIndicators = [
  // ============ 血液常规 - 数值型 ============
  { 
    name: '白细胞计数', 
    unit: '10^9/L', 
    type: '血液常规', 
    valueType: 'numeric',
    referenceRange: '3.5-9.5', 
    normalMin: 3.5, 
    normalMax: 9.5,
    isDefault: true 
  },
  { 
    name: '红细胞计数', 
    unit: '10^12/L', 
    type: '血液常规', 
    valueType: 'numeric',
    referenceRange: '男:4.3-5.8, 女:3.8-5.1',
    isDefault: true 
  },
  { 
    name: '血红蛋白', 
    unit: 'g/L', 
    type: '血液常规', 
    valueType: 'numeric',
    referenceRange: '男:130-175, 女:115-150',
    isDefault: true 
  },
  { 
    name: '血小板计数', 
    unit: '10^9/L', 
    type: '血液常规', 
    valueType: 'numeric',
    referenceRange: '125-350', 
    normalMin: 125, 
    normalMax: 350,
    isDefault: true 
  },
  { 
    name: '红细胞压积', 
    unit: '%', 
    type: '血液常规', 
    valueType: 'numeric',
    referenceRange: '男:40-50, 女:37-48',
    isDefault: true 
  },
  { 
    name: '平均红细胞体积', 
    unit: 'fL', 
    type: '血液常规', 
    valueType: 'numeric',
    referenceRange: '82-100', 
    normalMin: 82, 
    normalMax: 100,
    isDefault: true 
  },
  
  // ============ 生化检查 - 血糖代谢 ============
  { 
    name: '空腹血糖', 
    unit: 'mmol/L', 
    type: '生化检查', 
    valueType: 'numeric',
    referenceRange: '3.9-6.1', 
    normalMin: 3.9, 
    normalMax: 6.1,
    isDefault: true 
  },
  { 
    name: '餐后2小时血糖', 
    unit: 'mmol/L', 
    type: '生化检查', 
    valueType: 'numeric',
    referenceRange: '<7.8', 
    normalMin: 0, 
    normalMax: 7.8,
    isDefault: true 
  },
  { 
    name: '糖化血红蛋白', 
    unit: '%', 
    type: '生化检查', 
    valueType: 'numeric',
    referenceRange: '4.0-5.7', 
    normalMin: 4.0, 
    normalMax: 5.7,
    isDefault: true 
  },
  { 
    name: '空腹C肽', 
    unit: 'ng/ml', 
    type: '生化检查', 
    valueType: 'numeric',
    referenceRange: '0.8-4.2', 
    normalMin: 0.8, 
    normalMax: 4.2,
    isDefault: true 
  },
  { 
    name: '餐后2小时C肽', 
    unit: 'ng/ml', 
    type: '生化检查', 
    valueType: 'numeric',
    referenceRange: '3.0-9.0', 
    normalMin: 3.0, 
    normalMax: 9.0,
    isDefault: true 
  },
  { 
    name: '空腹胰岛素', 
    unit: 'mIU/L', 
    type: '生化检查', 
    valueType: 'numeric',
    referenceRange: '2.6-24.9', 
    normalMin: 2.6, 
    normalMax: 24.9,
    isDefault: true 
  },
  
  // ============ 生化检查 - 血脂 ============
  { 
    name: '总胆固醇', 
    unit: 'mmol/L', 
    type: '生化检查', 
    valueType: 'numeric',
    referenceRange: '<5.18', 
    normalMin: 0, 
    normalMax: 5.18,
    isDefault: true 
  },
  { 
    name: '甘油三酯', 
    unit: 'mmol/L', 
    type: '生化检查', 
    valueType: 'numeric',
    referenceRange: '<1.70', 
    normalMin: 0, 
    normalMax: 1.70,
    isDefault: true 
  },
  { 
    name: '高密度脂蛋白胆固醇', 
    unit: 'mmol/L', 
    type: '生化检查', 
    valueType: 'numeric',
    referenceRange: '男:>1.04, 女:>1.29',
    isDefault: true 
  },
  { 
    name: '低密度脂蛋白胆固醇', 
    unit: 'mmol/L', 
    type: '生化检查', 
    valueType: 'numeric',
    referenceRange: '<3.37', 
    normalMin: 0, 
    normalMax: 3.37,
    isDefault: true 
  },
  { 
    name: '载脂蛋白A1', 
    unit: 'g/L', 
    type: '生化检查', 
    valueType: 'numeric',
    referenceRange: '1.0-1.6', 
    normalMin: 1.0, 
    normalMax: 1.6,
    isDefault: true 
  },
  { 
    name: '载脂蛋白B', 
    unit: 'g/L', 
    type: '生化检查', 
    valueType: 'numeric',
    referenceRange: '0.6-1.1', 
    normalMin: 0.6, 
    normalMax: 1.1,
    isDefault: true 
  },
  { 
    name: '脂蛋白', 
    unit: 'mg/L', 
    type: '生化检查', 
    valueType: 'numeric',
    referenceRange: '<300', 
    normalMin: 0, 
    normalMax: 300,
    isDefault: true 
  },
  
  // ============ 生化检查 - 肾功能 ============
  { 
    name: '尿酸', 
    unit: 'umol/L', 
    type: '生化检查', 
    valueType: 'numeric',
    referenceRange: '男:208-428, 女:155-357',
    isDefault: true 
  },
  { 
    name: '肌酐', 
    unit: 'umol/L', 
    type: '生化检查', 
    valueType: 'numeric',
    referenceRange: '男:57-111, 女:41-73',
    isDefault: true 
  },
  { 
    name: '尿素氮', 
    unit: 'mmol/L', 
    type: '生化检查', 
    valueType: 'numeric',
    referenceRange: '3.6-9.5', 
    normalMin: 3.6, 
    normalMax: 9.5,
    isDefault: true 
  },
  { 
    name: '胱抑素C', 
    unit: 'mg/L', 
    type: '生化检查', 
    valueType: 'numeric',
    referenceRange: '0.51-1.09', 
    normalMin: 0.51, 
    normalMax: 1.09,
    isDefault: true 
  },
  { 
    name: '视黄醇结合蛋白', 
    unit: 'mg/L', 
    type: '生化检查', 
    valueType: 'numeric',
    referenceRange: '25-70', 
    normalMin: 25, 
    normalMax: 70,
    isDefault: true 
  },
  
  // ============ 肝功能 - 数值型 ============
  { 
    name: '丙氨酸氨基转移酶', 
    unit: 'U/L', 
    type: '肝功能', 
    valueType: 'numeric',
    referenceRange: '男:9-50, 女:7-40',
    isDefault: true 
  },
  { 
    name: '天门冬氨酸氨基转移酶', 
    unit: 'U/L', 
    type: '肝功能', 
    valueType: 'numeric',
    referenceRange: '男:15-40, 女:13-35',
    isDefault: true 
  },
  { 
    name: '总胆红素', 
    unit: 'umol/L', 
    type: '肝功能', 
    valueType: 'numeric',
    referenceRange: '5.1-22.2', 
    normalMin: 5.1, 
    normalMax: 22.2,
    isDefault: true 
  },
  { 
    name: '直接胆红素', 
    unit: 'umol/L', 
    type: '肝功能', 
    valueType: 'numeric',
    referenceRange: '0-6.8', 
    normalMin: 0, 
    normalMax: 6.8,
    isDefault: true 
  },
  { 
    name: '间接胆红素', 
    unit: 'umol/L', 
    type: '肝功能', 
    valueType: 'numeric',
    referenceRange: '1.7-10.2', 
    normalMin: 1.7, 
    normalMax: 10.2,
    isDefault: true 
  },
  { 
    name: '总蛋白', 
    unit: 'g/L', 
    type: '肝功能', 
    valueType: 'numeric',
    referenceRange: '60-80', 
    normalMin: 60, 
    normalMax: 80,
    isDefault: true 
  },
  { 
    name: '白蛋白', 
    unit: 'g/L', 
    type: '肝功能', 
    valueType: 'numeric',
    referenceRange: '40-55', 
    normalMin: 40, 
    normalMax: 55,
    isDefault: true 
  },
  { 
    name: '球蛋白', 
    unit: 'g/L', 
    type: '肝功能', 
    valueType: 'numeric',
    referenceRange: '20-30', 
    normalMin: 20, 
    normalMax: 30,
    isDefault: true 
  },
  { 
    name: '白球蛋白比值', 
    unit: '', 
    type: '肝功能', 
    valueType: 'numeric',
    referenceRange: '1.5-2.5', 
    normalMin: 1.5, 
    normalMax: 2.5,
    isDefault: true 
  },
  { 
    name: '碱性磷酸酶', 
    unit: 'U/L', 
    type: '肝功能', 
    valueType: 'numeric',
    referenceRange: '男:45-125, 女:35-100',
    isDefault: true 
  },
  { 
    name: 'γ-谷氨酰转肽酶', 
    unit: 'U/L', 
    type: '肝功能', 
    valueType: 'numeric',
    referenceRange: '男:11-50, 女:7-32',
    isDefault: true 
  },
  { 
    name: '胆碱酯酶', 
    unit: 'U/L', 
    type: '肝功能', 
    valueType: 'numeric',
    referenceRange: '3930-10800', 
    normalMin: 3930, 
    normalMax: 10800,
    isDefault: true 
  },
  { 
    name: '总胆汁酸', 
    unit: 'umol/L', 
    type: '肝功能', 
    valueType: 'numeric',
    referenceRange: '0-10', 
    normalMin: 0, 
    normalMax: 10,
    isDefault: true 
  },
  
  // ============ 甲状腺功能 - 数值型 ============
  { 
    name: '促甲状腺激素', 
    unit: 'mIU/L', 
    type: '甲状腺功能', 
    valueType: 'numeric',
    referenceRange: '0.27-4.2', 
    normalMin: 0.27, 
    normalMax: 4.2,
    isDefault: true 
  },
  { 
    name: '游离甲状腺素', 
    unit: 'pmol/L', 
    type: '甲状腺功能', 
    valueType: 'numeric',
    referenceRange: '12-22', 
    normalMin: 12, 
    normalMax: 22,
    isDefault: true 
  },
  { 
    name: '游离三碘甲状腺原氨酸', 
    unit: 'pmol/L', 
    type: '甲状腺功能', 
    valueType: 'numeric',
    referenceRange: '3.1-6.8', 
    normalMin: 3.1, 
    normalMax: 6.8,
    isDefault: true 
  },
  { 
    name: '总甲状腺素', 
    unit: 'nmol/L', 
    type: '甲状腺功能', 
    valueType: 'numeric',
    referenceRange: '66-181', 
    normalMin: 66, 
    normalMax: 181,
    isDefault: true 
  },
  
  // ============ 心肌损伤标志物 ============
  { 
    name: '肌钙蛋白I', 
    unit: 'ng/ml', 
    type: '心肌标志物', 
    valueType: 'numeric',
    referenceRange: '<0.04', 
    normalMin: 0, 
    normalMax: 0.04,
    isDefault: true 
  },
  { 
    name: '肌钙蛋白T', 
    unit: 'ng/ml', 
    type: '心肌标志物', 
    valueType: 'numeric',
    referenceRange: '<0.01', 
    normalMin: 0, 
    normalMax: 0.01,
    isDefault: true 
  },
  { 
    name: '肌酸激酶同工酶', 
    unit: 'U/L', 
    type: '心肌标志物', 
    valueType: 'numeric',
    referenceRange: '<25', 
    normalMin: 0, 
    normalMax: 25,
    isDefault: true 
  },
  { 
    name: '肌红蛋白', 
    unit: 'ng/ml', 
    type: '心肌标志物', 
    valueType: 'numeric',
    referenceRange: '<110', 
    normalMin: 0, 
    normalMax: 110,
    isDefault: true 
  },
  { 
    name: 'B型脑钠肽', 
    unit: 'pg/ml', 
    type: '心肌标志物', 
    valueType: 'numeric',
    referenceRange: '<100', 
    normalMin: 0, 
    normalMax: 100,
    isDefault: true 
  },
  { 
    name: 'N末端脑钠肽前体', 
    unit: 'pg/ml', 
    type: '心肌标志物', 
    valueType: 'numeric',
    referenceRange: '<125', 
    normalMin: 0, 
    normalMax: 125,
    isDefault: true 
  },
  
  // ============ 心脑血管相关 ============
  { 
    name: '同型半胱氨酸', 
    unit: 'umol/L', 
    type: '心脑血管', 
    valueType: 'numeric',
    referenceRange: '<15', 
    normalMin: 0, 
    normalMax: 15,
    isDefault: true 
  },
  { 
    name: '超敏C反应蛋白', 
    unit: 'mg/L', 
    type: '心脑血管', 
    valueType: 'numeric',
    referenceRange: '<3', 
    normalMin: 0, 
    normalMax: 3,
    isDefault: true 
  },
  
  // ============ 尿液检查 - 定性型 ============
  { 
    name: '尿蛋白', 
    unit: '', 
    type: '尿液检查', 
    valueType: 'qualitative',
    referenceRange: '阴性(-)', 
    normalValue: 'negative',
    isDefault: true 
  },
  { 
    name: '尿糖', 
    unit: '', 
    type: '尿液检查', 
    valueType: 'qualitative',
    referenceRange: '阴性(-)', 
    normalValue: 'negative',
    isDefault: true 
  },
  { 
    name: '尿潜血', 
    unit: '', 
    type: '尿液检查', 
    valueType: 'qualitative',
    referenceRange: '阴性(-)', 
    normalValue: 'negative',
    isDefault: true 
  },
  { 
    name: '尿酮体', 
    unit: '', 
    type: '尿液检查', 
    valueType: 'qualitative',
    referenceRange: '阴性(-)', 
    normalValue: 'negative',
    isDefault: true 
  },
  { 
    name: '尿白细胞', 
    unit: '', 
    type: '尿液检查', 
    valueType: 'qualitative',
    referenceRange: '阴性(-)', 
    normalValue: 'negative',
    isDefault: true 
  },
  { 
    name: '尿比重', 
    unit: '', 
    type: '尿液检查', 
    valueType: 'numeric',
    referenceRange: '1.005-1.030', 
    normalMin: 1.005, 
    normalMax: 1.030,
    isDefault: true 
  },
  { 
    name: '尿酸碱度', 
    unit: '', 
    type: '尿液检查', 
    valueType: 'numeric',
    referenceRange: '5.0-8.0', 
    normalMin: 5.0, 
    normalMax: 8.0,
    isDefault: true 
  },
  
  // ============ 心电图 - 数值型 ============
  { 
    name: '心率', 
    unit: '次/分', 
    type: '心电图', 
    valueType: 'numeric',
    referenceRange: '60-100', 
    normalMin: 60, 
    normalMax: 100,
    isDefault: true 
  },
  
  // ============ 血压 - 数值型 ============
  { 
    name: '收缩压', 
    unit: 'mmHg', 
    type: '血压', 
    valueType: 'numeric',
    referenceRange: '<140', 
    normalMin: 90, 
    normalMax: 140,
    isDefault: true 
  },
  {
    name: '舒张压',
    unit: 'mmHg',
    type: '血压',
    valueType: 'numeric',
    referenceRange: '<90',
    normalMin: 60,
    normalMax: 90,
    isDefault: true
  },

  // ============ 血液常规补充 ============
  {
    name: '平均红细胞血红蛋白含量',
    unit: 'pg',
    type: '血液常规',
    valueType: 'numeric',
    referenceRange: '27-34',
    normalMin: 27,
    normalMax: 34,
    isDefault: true
  },
  {
    name: '平均红细胞血红蛋白浓度',
    unit: 'g/L',
    type: '血液常规',
    valueType: 'numeric',
    referenceRange: '316-354',
    normalMin: 316,
    normalMax: 354,
    isDefault: true
  },
  {
    name: '红细胞分布宽度',
    unit: '%',
    type: '血液常规',
    valueType: 'numeric',
    referenceRange: '11.5-14.5',
    normalMin: 11.5,
    normalMax: 14.5,
    isDefault: true
  },
  {
    name: '中性粒细胞计数',
    unit: '10^9/L',
    type: '血液常规',
    valueType: 'numeric',
    referenceRange: '1.8-6.3',
    normalMin: 1.8,
    normalMax: 6.3,
    isDefault: true
  },
  {
    name: '淋巴细胞计数',
    unit: '10^9/L',
    type: '血液常规',
    valueType: 'numeric',
    referenceRange: '1.1-3.2',
    normalMin: 1.1,
    normalMax: 3.2,
    isDefault: true
  },
  {
    name: '单核细胞计数',
    unit: '10^9/L',
    type: '血液常规',
    valueType: 'numeric',
    referenceRange: '0.1-0.6',
    normalMin: 0.1,
    normalMax: 0.6,
    isDefault: true
  },
  {
    name: '嗜酸性粒细胞计数',
    unit: '10^9/L',
    type: '血液常规',
    valueType: 'numeric',
    referenceRange: '0.02-0.52',
    normalMin: 0.02,
    normalMax: 0.52,
    isDefault: true
  },
  {
    name: '嗜碱性粒细胞计数',
    unit: '10^9/L',
    type: '血液常规',
    valueType: 'numeric',
    referenceRange: '0-0.06',
    normalMin: 0,
    normalMax: 0.06,
    isDefault: true
  },
  {
    name: '中性粒细胞比值',
    unit: '%',
    type: '血液常规',
    valueType: 'numeric',
    referenceRange: '40-75',
    normalMin: 40,
    normalMax: 75,
    isDefault: true
  },
  {
    name: '淋巴细胞比值',
    unit: '%',
    type: '血液常规',
    valueType: 'numeric',
    referenceRange: '20-50',
    normalMin: 20,
    normalMax: 50,
    isDefault: true
  },
  {
    name: '单核细胞比值',
    unit: '%',
    type: '血液常规',
    valueType: 'numeric',
    referenceRange: '3-10',
    normalMin: 3,
    normalMax: 10,
    isDefault: true
  },

  // ============ 凝血功能 ============
  {
    name: '凝血酶原时间',
    unit: '秒',
    type: '凝血功能',
    valueType: 'numeric',
    referenceRange: '11-14',
    normalMin: 11,
    normalMax: 14,
    isDefault: true
  },
  {
    name: '国际标准化比值',
    unit: '',
    type: '凝血功能',
    valueType: 'numeric',
    referenceRange: '0.8-1.2',
    normalMin: 0.8,
    normalMax: 1.2,
    isDefault: true
  },
  {
    name: '活化部分凝血活酶时间',
    unit: '秒',
    type: '凝血功能',
    valueType: 'numeric',
    referenceRange: '25-37',
    normalMin: 25,
    normalMax: 37,
    isDefault: true
  },
  {
    name: '凝血酶时间',
    unit: '秒',
    type: '凝血功能',
    valueType: 'numeric',
    referenceRange: '14-21',
    normalMin: 14,
    normalMax: 21,
    isDefault: true
  },
  {
    name: '纤维蛋白原',
    unit: 'g/L',
    type: '凝血功能',
    valueType: 'numeric',
    referenceRange: '2-4',
    normalMin: 2,
    normalMax: 4,
    isDefault: true
  },
  {
    name: 'D-二聚体',
    unit: 'mg/L',
    type: '凝血功能',
    valueType: 'numeric',
    referenceRange: '<0.5',
    normalMin: 0,
    normalMax: 0.5,
    isDefault: true
  },

  // ============ 糖尿病相关补充 ============
  {
    name: '果糖胺',
    unit: 'mmol/L',
    type: '生化检查',
    valueType: 'numeric',
    referenceRange: '1.6-2.6',
    normalMin: 1.6,
    normalMax: 2.6,
    isDefault: true
  },
  {
    name: '乳酸',
    unit: 'mmol/L',
    type: '生化检查',
    valueType: 'numeric',
    referenceRange: '0.5-2.0',
    normalMin: 0.5,
    normalMax: 2.0,
    isDefault: true
  },
  {
    name: 'β-羟基丁酸',
    unit: 'mmol/L',
    type: '生化检查',
    valueType: 'numeric',
    referenceRange: '0.03-0.30',
    normalMin: 0.03,
    normalMax: 0.30,
    isDefault: true
  },

  // ============ 电解质 ============
  {
    name: '钾',
    unit: 'mmol/L',
    type: '电解质',
    valueType: 'numeric',
    referenceRange: '3.5-5.3',
    normalMin: 3.5,
    normalMax: 5.3,
    isDefault: true
  },
  {
    name: '钠',
    unit: 'mmol/L',
    type: '电解质',
    valueType: 'numeric',
    referenceRange: '137-147',
    normalMin: 137,
    normalMax: 147,
    isDefault: true
  },
  {
    name: '氯',
    unit: 'mmol/L',
    type: '电解质',
    valueType: 'numeric',
    referenceRange: '99-110',
    normalMin: 99,
    normalMax: 110,
    isDefault: true
  },
  {
    name: '钙',
    unit: 'mmol/L',
    type: '电解质',
    valueType: 'numeric',
    referenceRange: '2.11-2.52',
    normalMin: 2.11,
    normalMax: 2.52,
    isDefault: true
  },
  {
    name: '磷',
    unit: 'mmol/L',
    type: '电解质',
    valueType: 'numeric',
    referenceRange: '0.85-1.51',
    normalMin: 0.85,
    normalMax: 1.51,
    isDefault: true
  },
  {
    name: '镁',
    unit: 'mmol/L',
    type: '电解质',
    valueType: 'numeric',
    referenceRange: '0.75-1.02',
    normalMin: 0.75,
    normalMax: 1.02,
    isDefault: true
  },

  // ============ 铁代谢 ============
  {
    name: '血清铁',
    unit: 'umol/L',
    type: '铁代谢',
    valueType: 'numeric',
    referenceRange: '男:11.6-31.3, 女:9.0-30.4',
    isDefault: true
  },
  {
    name: '血清铁蛋白',
    unit: 'ug/L',
    type: '铁代谢',
    valueType: 'numeric',
    referenceRange: '男:30-400, 女:13-150',
    isDefault: true
  },
  {
    name: '总铁结合力',
    unit: 'umol/L',
    type: '铁代谢',
    valueType: 'numeric',
    referenceRange: '45-70',
    normalMin: 45,
    normalMax: 70,
    isDefault: true
  },
  {
    name: '转铁蛋白',
    unit: 'g/L',
    type: '铁代谢',
    valueType: 'numeric',
    referenceRange: '2.0-3.6',
    normalMin: 2.0,
    normalMax: 3.6,
    isDefault: true
  },
  {
    name: '转铁蛋白饱和度',
    unit: '%',
    type: '铁代谢',
    valueType: 'numeric',
    referenceRange: '20-55',
    normalMin: 20,
    normalMax: 55,
    isDefault: true
  },

  // ============ 肿瘤标志物 ============
  {
    name: '甲胎蛋白',
    unit: 'ng/ml',
    type: '肿瘤标志物',
    valueType: 'numeric',
    referenceRange: '<7',
    normalMin: 0,
    normalMax: 7,
    isDefault: true
  },
  {
    name: '癌胚抗原',
    unit: 'ng/ml',
    type: '肿瘤标志物',
    valueType: 'numeric',
    referenceRange: '<5',
    normalMin: 0,
    normalMax: 5,
    isDefault: true
  },
  {
    name: '糖类抗原125',
    unit: 'U/ml',
    type: '肿瘤标志物',
    valueType: 'numeric',
    referenceRange: '<35',
    normalMin: 0,
    normalMax: 35,
    isDefault: true
  },
  {
    name: '糖类抗原19-9',
    unit: 'U/ml',
    type: '肿瘤标志物',
    valueType: 'numeric',
    referenceRange: '<37',
    normalMin: 0,
    normalMax: 37,
    isDefault: true
  },
  {
    name: '糖类抗原15-3',
    unit: 'U/ml',
    type: '肿瘤标志物',
    valueType: 'numeric',
    referenceRange: '<25',
    normalMin: 0,
    normalMax: 25,
    isDefault: true
  },
  {
    name: '糖类抗原72-4',
    unit: 'U/ml',
    type: '肿瘤标志物',
    valueType: 'numeric',
    referenceRange: '<6.9',
    normalMin: 0,
    normalMax: 6.9,
    isDefault: true
  },
  {
    name: '前列腺特异抗原',
    unit: 'ng/ml',
    type: '肿瘤标志物',
    valueType: 'numeric',
    referenceRange: '<4',
    normalMin: 0,
    normalMax: 4,
    isDefault: true
  },
  {
    name: '糖类抗原50',
    unit: 'U/ml',
    type: '肿瘤标志物',
    valueType: 'numeric',
    referenceRange: '<25',
    normalMin: 0,
    normalMax: 25,
    isDefault: true
  },
  {
    name: '细胞角蛋白19片段',
    unit: 'ng/ml',
    type: '肿瘤标志物',
    valueType: 'numeric',
    referenceRange: '<3.3',
    normalMin: 0,
    normalMax: 3.3,
    isDefault: true
  },
  {
    name: '鳞状细胞癌抗原',
    unit: 'ng/ml',
    type: '肿瘤标志物',
    valueType: 'numeric',
    referenceRange: '<1.5',
    normalMin: 0,
    normalMax: 1.5,
    isDefault: true
  },
  {
    name: '神经元特异性烯醇化酶',
    unit: 'ng/ml',
    type: '肿瘤标志物',
    valueType: 'numeric',
    referenceRange: '<16.3',
    normalMin: 0,
    normalMax: 16.3,
    isDefault: true
  },

  // ============ 免疫功能 ============
  {
    name: '免疫球蛋白G',
    unit: 'g/L',
    type: '免疫功能',
    valueType: 'numeric',
    referenceRange: '7-16',
    normalMin: 7,
    normalMax: 16,
    isDefault: true
  },
  {
    name: '免疫球蛋白A',
    unit: 'g/L',
    type: '免疫功能',
    valueType: 'numeric',
    referenceRange: '0.7-4.0',
    normalMin: 0.7,
    normalMax: 4.0,
    isDefault: true
  },
  {
    name: '免疫球蛋白M',
    unit: 'g/L',
    type: '免疫功能',
    valueType: 'numeric',
    referenceRange: '0.4-2.3',
    normalMin: 0.4,
    normalMax: 2.3,
    isDefault: true
  },
  {
    name: '补体C3',
    unit: 'g/L',
    type: '免疫功能',
    valueType: 'numeric',
    referenceRange: '0.9-1.8',
    normalMin: 0.9,
    normalMax: 1.8,
    isDefault: true
  },
  {
    name: '补体C4',
    unit: 'g/L',
    type: '免疫功能',
    valueType: 'numeric',
    referenceRange: '0.1-0.4',
    normalMin: 0.1,
    normalMax: 0.4,
    isDefault: true
  },
  {
    name: 'C反应蛋白',
    unit: 'mg/L',
    type: '免疫功能',
    valueType: 'numeric',
    referenceRange: '<10',
    normalMin: 0,
    normalMax: 10,
    isDefault: true
  },

  // ============ 甲状腺补充 ============
  {
    name: '甲状腺过氧化物酶抗体',
    unit: 'IU/ml',
    type: '甲状腺功能',
    valueType: 'numeric',
    referenceRange: '<34',
    normalMin: 0,
    normalMax: 34,
    isDefault: true
  },
  {
    name: '甲状腺球蛋白抗体',
    unit: 'IU/ml',
    type: '甲状腺功能',
    valueType: 'numeric',
    referenceRange: '<115',
    normalMin: 0,
    normalMax: 115,
    isDefault: true
  },
  {
    name: '促甲状腺素受体抗体',
    unit: 'IU/L',
    type: '甲状腺功能',
    valueType: 'numeric',
    referenceRange: '<1.75',
    normalMin: 0,
    normalMax: 1.75,
    isDefault: true
  },

  // ============ 性激素六项 ============
  {
    name: '促卵泡生成素',
    unit: 'mIU/ml',
    type: '性激素',
    valueType: 'numeric',
    referenceRange: '男:1.5-12.4, 女:卵泡期3.5-12.5',
    isDefault: true
  },
  {
    name: '促黄体生成素',
    unit: 'mIU/ml',
    type: '性激素',
    valueType: 'numeric',
    referenceRange: '男:1.7-8.6, 女:卵泡期2.4-12.6',
    isDefault: true
  },
  {
    name: '雌二醇',
    unit: 'pg/ml',
    type: '性激素',
    valueType: 'numeric',
    referenceRange: '男:11-44, 女:卵泡期46-607',
    isDefault: true
  },
  {
    name: '孕酮',
    unit: 'ng/ml',
    type: '性激素',
    valueType: 'numeric',
    referenceRange: '男:0.14-2.06, 女:卵泡期0.15-1.40',
    isDefault: true
  },
  {
    name: '睾酮',
    unit: 'nmol/L',
    type: '性激素',
    valueType: 'numeric',
    referenceRange: '男:9.9-27.8, 女:0.22-2.9',
    isDefault: true
  },
  {
    name: '泌乳素',
    unit: 'ng/ml',
    type: '性激素',
    valueType: 'numeric',
    referenceRange: '男:3.5-19.4, 女:5.2-26.5',
    isDefault: true
  },

  // ============ 骨代谢 ============
  {
    name: '骨钙素',
    unit: 'ng/ml',
    type: '骨代谢',
    valueType: 'numeric',
    referenceRange: '14-46',
    normalMin: 14,
    normalMax: 46,
    isDefault: true
  },
  {
    name: '降钙素',
    unit: 'pg/ml',
    type: '骨代谢',
    valueType: 'numeric',
    referenceRange: '<100',
    normalMin: 0,
    normalMax: 100,
    isDefault: true
  },
  {
    name: '甲状旁腺激素',
    unit: 'pg/ml',
    type: '骨代谢',
    valueType: 'numeric',
    referenceRange: '15-65',
    normalMin: 15,
    normalMax: 65,
    isDefault: true
  },
  {
    name: '25-羟维生素D',
    unit: 'ng/ml',
    type: '骨代谢',
    valueType: 'numeric',
    referenceRange: '20-100',
    normalMin: 20,
    normalMax: 100,
    isDefault: true
  },

  // ============ 炎症/感染指标补充 ============
  {
    name: '降钙素原',
    unit: 'ng/ml',
    type: '炎症指标',
    valueType: 'numeric',
    referenceRange: '<0.05',
    normalMin: 0,
    normalMax: 0.05,
    isDefault: true
  },
  {
    name: '白介素6',
    unit: 'pg/ml',
    type: '炎症指标',
    valueType: 'numeric',
    referenceRange: '<7',
    normalMin: 0,
    normalMax: 7,
    isDefault: true
  },
  {
    name: '血沉',
    unit: 'mm/h',
    type: '炎症指标',
    valueType: 'numeric',
    referenceRange: '男:0-15, 女:0-20',
    isDefault: true
  },

  // ============ 粪便检查 ============
  {
    name: '粪便隐血',
    unit: '',
    type: '粪便检查',
    valueType: 'qualitative',
    referenceRange: '阴性(-)',
    normalValue: 'negative',
    isDefault: true
  },
  {
    name: '粪便轮状病毒',
    unit: '',
    type: '粪便检查',
    valueType: 'qualitative',
    referenceRange: '阴性(-)',
    normalValue: 'negative',
    isDefault: true
  },

  // ============ 维生素/营养 ============
  {
    name: '维生素B12',
    unit: 'pg/ml',
    type: '维生素/营养',
    valueType: 'numeric',
    referenceRange: '180-914',
    normalMin: 180,
    normalMax: 914,
    isDefault: true
  },
  {
    name: '叶酸',
    unit: 'ng/ml',
    type: '维生素/营养',
    valueType: 'numeric',
    referenceRange: '3.1-17.5',
    normalMin: 3.1,
    normalMax: 17.5,
    isDefault: true
  },
  {
    name: '维生素A',
    unit: 'umol/L',
    type: '维生素/营养',
    valueType: 'numeric',
    referenceRange: '0.5-2.1',
    normalMin: 0.5,
    normalMax: 2.1,
    isDefault: true
  },

  // ============ 尿液定量 ============
  {
    name: '24小时尿蛋白',
    unit: 'g/24h',
    type: '尿液检查',
    valueType: 'numeric',
    referenceRange: '<0.15',
    normalMin: 0,
    normalMax: 0.15,
    isDefault: true
  },
  {
    name: '24小时尿微量白蛋白',
    unit: 'mg/24h',
    type: '尿液检查',
    valueType: 'numeric',
    referenceRange: '<30',
    normalMin: 0,
    normalMax: 30,
    isDefault: true
  },
  {
    name: '尿微量白蛋白/肌酐比值',
    unit: 'mg/g',
    type: '尿液检查',
    valueType: 'numeric',
    referenceRange: '<30',
    normalMin: 0,
    normalMax: 30,
    isDefault: true
  },

  // ============ 肝纤维化 ============
  {
    name: '透明质酸',
    unit: 'ng/ml',
    type: '肝纤维化',
    valueType: 'numeric',
    referenceRange: '<120',
    normalMin: 0,
    normalMax: 120,
    isDefault: true
  },
  {
    name: '层粘连蛋白',
    unit: 'ng/ml',
    type: '肝纤维化',
    valueType: 'numeric',
    referenceRange: '50-180',
    normalMin: 50,
    normalMax: 180,
    isDefault: true
  },
  {
    name: 'III型前胶原N端肽',
    unit: 'ng/ml',
    type: '肝纤维化',
    valueType: 'numeric',
    referenceRange: '<120',
    normalMin: 0,
    normalMax: 120,
    isDefault: true
  },
  {
    name: 'IV型胶原',
    unit: 'ng/ml',
    type: '肝纤维化',
    valueType: 'numeric',
    referenceRange: '30-140',
    normalMin: 30,
    normalMax: 140,
    isDefault: true
  }
];

module.exports = defaultIndicators;
