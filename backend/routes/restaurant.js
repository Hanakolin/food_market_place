const express = require('express');
const { body, validationResult } = require('express-validator');
const { pool } = require('../config/database');
const { asyncHandler, AppError } = require('../middleware/errorHandler');
const { authenticateToken, requireCook, optionalAuth } = require('../middleware/auth');

const router = express.Router();

// @route   GET /api/restaurants
// @desc    Get all restaurants (public)
// @access  Public
router.get('/', optionalAuth, asyncHandler(async (req, res) => {
    const [restaurants] = await pool.execute(`
        SELECT r.*, u.first_name, u.last_name
        FROM restaurants r
        JOIN users u ON r.cook_id = u.id
        WHERE r.is_active = true
        ORDER BY r.rating DESC
    `);

    res.json({
        success: true,
        data: { restaurants }
    });
}));

// @route   GET /api/restaurants/:id
// @desc    Get restaurant details
// @access  Public
router.get('/:id', optionalAuth, asyncHandler(async (req, res) => {
    const [restaurants] = await pool.execute(`
        SELECT r.*, u.first_name, u.last_name
        FROM restaurants r
        JOIN users u ON r.cook_id = u.id
        WHERE r.id = ? AND r.is_active = true
    `, [req.params.id]);

    if (restaurants.length === 0) {
        throw new AppError('Restaurant not found', 404);
    }

    res.json({
        success: true,
        data: { restaurant: restaurants[0] }
    });
}));

// @route   POST /api/restaurants
// @desc    Create restaurant profile
// @access  Private (Cook only)
router.post('/', 
    authenticateToken,
    requireCook,
    [
        body('name').isLength({ min: 2 }).trim().withMessage('Restaurant name is required'),
        body('cuisine_type').notEmpty().withMessage('Cuisine type is required'),
        body('phone').isMobilePhone().withMessage('Valid phone number is required')
    ],
    asyncHandler(async (req, res) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({
                success: false,
                message: 'Validation failed',
                errors: errors.array()
            });
        }

        // Check if cook already has a restaurant
        const [existing] = await pool.execute(
            'SELECT id FROM restaurants WHERE cook_id = ?',
            [req.user.id]
        );

        if (existing.length > 0) {
            return res.status(400).json({
                success: false,
                message: 'You already have a restaurant profile'
            });
        }

        const { name, description, cuisine_type, phone, email } = req.body;

        const [result] = await pool.execute(
            'INSERT INTO restaurants (cook_id, name, description, cuisine_type, phone, email) VALUES (?, ?, ?, ?, ?, ?)',
            [req.user.id, name, description, cuisine_type, phone, email]
        );

        const [restaurant] = await pool.execute(
            'SELECT * FROM restaurants WHERE id = ?',
            [result.insertId]
        );

        res.status(201).json({
            success: true,
            message: 'Restaurant created successfully',
            data: { restaurant: restaurant[0] }
        });
    })
);

module.exports = router;
