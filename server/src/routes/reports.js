const express = require('express');
const { authenticateToken } = require('../middleware/auth');
const { reportUpload } = require('../services/reportService');
const c = require('../controllers/reportsController');

const router = express.Router();
router.get('/', authenticateToken, c.list);
router.get('/:id', authenticateToken, c.getDetail);
router.post('/', authenticateToken, reportUpload.single('file'), c.create);
router.put('/:id', authenticateToken, reportUpload.single('file'), c.update);
router.delete('/:id', authenticateToken, c.remove);
module.exports = router;
