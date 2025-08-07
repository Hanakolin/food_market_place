const express = require('express');
const { authenticateToken } = require('../middleware/auth');
const { asyncHandler } = require('../middleware/errorHandler');

const router = express.Router();

// Placeholder for review routes
router.get('/', (req, res) => {
    res.json({ success: true, message: 'Review routes placeholder' });
});

module.exports = router;
