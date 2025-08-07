const express = require('express');
const { authenticateToken, requireAdmin } = require('../middleware/auth');
const { asyncHandler } = require('../middleware/errorHandler');

const router = express.Router();

// Placeholder for admin routes
router.get('/', authenticateToken, requireAdmin, (req, res) => {
    res.json({ success: true, message: 'Admin routes placeholder' });
});

module.exports = router;
