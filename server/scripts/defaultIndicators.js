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
  }
];

module.exports = defaultIndicators;
