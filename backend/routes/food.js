const express = require('express');
const { body, validationResult } = require('express-validator');
const { pool } = require('../config/database');
const { asyncHandler, AppError } = require('../middleware/errorHandler');
const { optionalAuth, authenticateToken, requireCook } = require('../middleware/auth');

const router = express.Router();

// @route   GET /api/food
// @desc    Get all food items
// @access  Public
router.get('/', optionalAuth, asyncHandler(async (req, res) => {
    const [foodItems] = await pool.execute(`
        SELECT fi.*, c.name as category_name, r.name as restaurant_name
        FROM food_items fi
        LEFT JOIN categories c ON fi.category_id = c.id
        LEFT JOIN restaurants r ON fi.restaurant_id = r.id
        WHERE fi.is_available = true AND r.is_active = true
        ORDER BY fi.rating DESC, fi.total_orders DESC
        LIMIT 100
    `);

    res.json({
        success: true,
        data: { foodItems }
    });
}));

// @route   GET /api/food/search
// @desc    Search food items
// @access  Public
router.get('/search', optionalAuth, asyncHandler(async (req, res) => {
    const { q } = req.query;
    
    if (!q || q.trim().length === 0) {
        return res.json({
            success: true,
            data: { foodItems: [] }
        });
    }

    const searchTerm = `%${q.trim()}%`;
    const [foodItems] = await pool.execute(`
        SELECT fi.*, c.name as category_name, r.name as restaurant_name
        FROM food_items fi
        LEFT JOIN categories c ON fi.category_id = c.id
        LEFT JOIN restaurants r ON fi.restaurant_id = r.id
        WHERE (fi.name LIKE ? OR fi.description LIKE ? OR c.name LIKE ?) 
              AND fi.is_available = true AND r.is_active = true
        ORDER BY fi.rating DESC, fi.total_orders DESC
        LIMIT 50
    `, [searchTerm, searchTerm, searchTerm]);

    res.json({
        success: true,
        data: { foodItems }
    });
}));

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

// @route   POST /api/food
// @desc    Create a new food item
// @access  Private (Cook only)
router.post('/', 
    authenticateToken,
    requireCook,
    [
        body('name').isLength({ min: 2 }).trim().withMessage('Food item name is required'),
        body('price').isFloat({ min: 0 }).withMessage('Valid price is required'),
        body('preparation_time').isInt({ min: 1 }).withMessage('Valid preparation time is required')
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

        // Get cook's restaurant
        const [restaurants] = await pool.execute(
            'SELECT id FROM restaurants WHERE cook_id = ? AND is_active = true',
            [req.user.id]
        );

        if (restaurants.length === 0) {
            throw new AppError('You need to create a restaurant profile first', 400);
        }

        const restaurantId = restaurants[0].id;
        const {
            name, description, price, category_id, image,
            is_vegetarian = false, is_vegan = false, is_spicy = false,
            preparation_time, is_available = true
        } = req.body;

        const [result] = await pool.execute(`
            INSERT INTO food_items (
                restaurant_id, category_id, name, description, price, image,
                is_vegetarian, is_vegan, is_spicy, preparation_time, is_available
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [
            restaurantId, category_id || null, name, description || null, price, image || null,
            is_vegetarian, is_vegan, is_spicy, preparation_time, is_available
        ]);

        const [foodItem] = await pool.execute(
            'SELECT * FROM food_items WHERE id = ?',
            [result.insertId]
        );

        res.status(201).json({
            success: true,
            message: 'Food item created successfully',
            data: { foodItem: foodItem[0] }
        });
    })
);

// @route   PUT /api/food/:id
// @desc    Update a food item
// @access  Private (Cook only)
router.put('/:id', 
    authenticateToken,
    requireCook,
    [
        body('name').optional().isLength({ min: 2 }).trim().withMessage('Food item name must be at least 2 characters'),
        body('price').optional().isFloat({ min: 0 }).withMessage('Valid price is required'),
        body('preparation_time').optional().isInt({ min: 1 }).withMessage('Valid preparation time is required')
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

        const foodItemId = req.params.id;

        // Verify the food item belongs to the cook's restaurant
        const [foodItems] = await pool.execute(`
            SELECT fi.id FROM food_items fi
            JOIN restaurants r ON fi.restaurant_id = r.id
            WHERE fi.id = ? AND r.cook_id = ?
        `, [foodItemId, req.user.id]);

        if (foodItems.length === 0) {
            throw new AppError('Food item not found or access denied', 404);
        }

        const updateFields = [];
        const values = [];
        const allowedFields = [
            'name', 'description', 'price', 'category_id', 'image',
            'is_vegetarian', 'is_vegan', 'is_spicy', 'preparation_time', 'is_available'
        ];

        allowedFields.forEach(field => {
            if (req.body.hasOwnProperty(field)) {
                updateFields.push(`${field} = ?`);
                values.push(req.body[field]);
            }
        });

        if (updateFields.length === 0) {
            return res.status(400).json({
                success: false,
                message: 'No valid fields to update'
            });
        }

        values.push(foodItemId);
        await pool.execute(
            `UPDATE food_items SET ${updateFields.join(', ')} WHERE id = ?`,
            values
        );

        const [updatedFoodItem] = await pool.execute(
            'SELECT * FROM food_items WHERE id = ?',
            [foodItemId]
        );

        res.json({
            success: true,
            message: 'Food item updated successfully',
            data: { foodItem: updatedFoodItem[0] }
        });
    })
);

// @route   DELETE /api/food/:id
// @desc    Delete a food item
// @access  Private (Cook only)
router.delete('/:id', 
    authenticateToken,
    requireCook,
    asyncHandler(async (req, res) => {
        const foodItemId = req.params.id;

        // Verify the food item belongs to the cook's restaurant
        const [foodItems] = await pool.execute(`
            SELECT fi.id FROM food_items fi
            JOIN restaurants r ON fi.restaurant_id = r.id
            WHERE fi.id = ? AND r.cook_id = ?
        `, [foodItemId, req.user.id]);

        if (foodItems.length === 0) {
            throw new AppError('Food item not found or access denied', 404);
        }

        await pool.execute('DELETE FROM food_items WHERE id = ?', [foodItemId]);

        res.json({
            success: true,
            message: 'Food item deleted successfully'
        });
    })
);

module.exports = router;
