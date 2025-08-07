const express = require('express');
const { authenticateToken, requireCustomer } = require('../middleware/auth');
const { asyncHandler } = require('../middleware/errorHandler');
const { pool } = require('../config/database');

const router = express.Router();

// @route   GET /api/users/cart
// @desc    Get user's cart items
// @access  Private (Customer only)
router.get('/cart', authenticateToken, requireCustomer, asyncHandler(async (req, res) => {
    const [cartItems] = await pool.execute(`
        SELECT ci.*, fi.name, fi.price, fi.image, fi.is_available,
               r.name as restaurant_name, r.id as restaurant_id
        FROM cart_items ci
        JOIN food_items fi ON ci.food_item_id = fi.id
        JOIN restaurants r ON fi.restaurant_id = r.id
        WHERE ci.customer_id = ?
        ORDER BY ci.created_at DESC
    `, [req.user.id]);

    res.json({
        success: true,
        data: { cartItems }
    });
}));

// @route   POST /api/users/cart
// @desc    Add item to cart
// @access  Private (Customer only)
router.post('/cart', authenticateToken, requireCustomer, asyncHandler(async (req, res) => {
    const { food_item_id, quantity = 1 } = req.body;
    
    // Check if item already in cart
    const [existing] = await pool.execute(
        'SELECT id, quantity FROM cart_items WHERE customer_id = ? AND food_item_id = ?',
        [req.user.id, food_item_id]
    );

    if (existing.length > 0) {
        // Update quantity
        await pool.execute(
            'UPDATE cart_items SET quantity = quantity + ? WHERE id = ?',
            [quantity, existing[0].id]
        );
    } else {
        // Add new item
        await pool.execute(
            'INSERT INTO cart_items (customer_id, food_item_id, quantity) VALUES (?, ?, ?)',
            [req.user.id, food_item_id, quantity]
        );
    }

    res.json({
        success: true,
        message: 'Item added to cart'
    });
}));

// @route   DELETE /api/users/cart/:id
// @desc    Remove item from cart
// @access  Private (Customer only)
router.delete('/cart/:id', authenticateToken, requireCustomer, asyncHandler(async (req, res) => {
    await pool.execute(
        'DELETE FROM cart_items WHERE id = ? AND customer_id = ?',
        [req.params.id, req.user.id]
    );

    res.json({
        success: true,
        message: 'Item removed from cart'
    });
}));

module.exports = router;
