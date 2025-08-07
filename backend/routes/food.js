const express = require('express');
const { pool } = require('../config/database');
const { asyncHandler } = require('../middleware/errorHandler');
const { optionalAuth } = require('../middleware/auth');

const router = express.Router();

// @route   GET /api/food/restaurant/:restaurantId
// @desc    Get food items by restaurant
// @access  Public
router.get('/restaurant/:restaurantId', optionalAuth, asyncHandler(async (req, res) => {
    const [foodItems] = await pool.execute(`
        SELECT fi.*, c.name as category_name
        FROM food_items fi
        LEFT JOIN categories c ON fi.category_id = c.id
        WHERE fi.restaurant_id = ? AND fi.is_available = true
        ORDER BY c.sort_order, fi.name
    `, [req.params.restaurantId]);

    res.json({
        success: true,
        data: { foodItems }
    });
}));

// @route   GET /api/food/categories
// @desc    Get all categories
// @access  Public
router.get('/categories', asyncHandler(async (req, res) => {
    const [categories] = await pool.execute(
        'SELECT * FROM categories WHERE is_active = true ORDER BY sort_order'
    );

    res.json({
        success: true,
        data: { categories }
    });
}));

module.exports = router;
