const express = require('express');
const { requireAdmin } = require('../middleware/admin');
const c = require('../controllers/invitesController');

const router = express.Router();
router.get('/', requireAdmin, c.list);
router.post('/', requireAdmin, c.create);
router.delete('/:id', requireAdmin, c.remove);
module.exports = router;
