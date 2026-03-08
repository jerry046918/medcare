const express = require('express');
const router = express.Router();
const hospitalsData = require('../data/hospitals.json');

// 搜索医院
router.get('/search', (req, res) => {
  try {
    const { keyword, province, limit = 20 } = req.query;
    
    let results = hospitalsData.hospitals;
    
    // 按关键词过滤
    if (keyword && keyword.trim()) {
      const keywordLower = keyword.toLowerCase().trim();
      results = results.filter(hospital => 
        (hospital.name && hospital.name.toLowerCase().includes(keywordLower)) ||
        (hospital.province && hospital.province.includes(keyword)) ||
        (hospital.city && hospital.city.includes(keyword))
      );
    }
    
    // 按省份过滤
    if (province && province.trim()) {
      results = results.filter(hospital => 
        hospital.province.includes(province.trim())
      );
    }
    
    // 限制返回数量
    results = results.slice(0, parseInt(limit));
    
    res.json({
      success: true,
      data: results,
      total: results.length
    });
  } catch (error) {
    console.error('搜索医院失败:', error);
    res.status(500).json({
      success: false,
      message: '搜索医院失败',
      error: error.message
    });
  }
});

// 获取所有省份
router.get('/provinces', (req, res) => {
  try {
    const provinces = [...new Set(hospitalsData.hospitals.map(h => h.province))];
    res.json({
      success: true,
      data: provinces.sort()
    });
  } catch (error) {
    console.error('获取省份列表失败:', error);
    res.status(500).json({
      success: false,
      message: '获取省份列表失败',
      error: error.message
    });
  }
});

// 获取所有医院（用于下拉列表）
router.get('/all', (req, res) => {
  try {
    res.json({
      success: true,
      data: hospitalsData.hospitals
    });
  } catch (error) {
    console.error('获取医院列表失败:', error);
    res.status(500).json({
      success: false,
      message: '获取医院列表失败',
      error: error.message
    });
  }
});

module.exports = router;
