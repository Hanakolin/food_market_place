const express = require('express');
const { body, validationResult } = require('express-validator');
const { pool } = require('../config/database');
const { asyncHandler, AppError } = require('../middleware/errorHandler');
const { authenticateToken, requireCustomer, requireCook, requireAdmin } = require('../middleware/auth');

const router = express.Router();

// Generate unique order number
const generateOrderNumber = () => {
    const timestamp = Date.now().toString();
    const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
    return `ORD-${timestamp.slice(-6)}${random}`;
};

// @route   POST /api/orders
// @desc    Create a new order
// @access  Private (Customer only)
router.post('/', 
    authenticateToken,
    requireCustomer,
    [
        body('restaurant_id').isInt({ min: 1 }).withMessage('Valid restaurant ID is required'),
        body('items').isArray({ min: 1 }).withMessage('Order items are required'),
        body('items.*.food_item_id').isInt({ min: 1 }).withMessage('Valid food item ID is required'),
        body('items.*.quantity').isInt({ min: 1 }).withMessage('Valid quantity is required'),
        body('delivery_address').isObject().withMessage('Delivery address is required'),
        body('payment_method').isIn(['cash', 'card', 'upi', 'wallet']).withMessage('Valid payment method is required')
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

        const { restaurant_id, items, delivery_address, payment_method, special_instructions } = req.body;
        const customer_id = req.user.id;

        // Start transaction
        const connection = await pool.getConnection();
        await connection.beginTransaction();

        try {
            // Verify restaurant exists and is active
            const [restaurants] = await connection.execute(
                'SELECT id, delivery_fee FROM restaurants WHERE id = ? AND is_active = true',
                [restaurant_id]
            );

            if (restaurants.length === 0) {
                throw new AppError('Restaurant not found or inactive', 404);
            }

            const restaurant = restaurants[0];

            // Validate and calculate order total
            let totalAmount = 0;
            const orderItems = [];

            for (const item of items) {
                const [foodItems] = await connection.execute(
                    'SELECT id, name, price, is_available FROM food_items WHERE id = ? AND restaurant_id = ?',
                    [item.food_item_id, restaurant_id]
                );

                if (foodItems.length === 0) {
                    throw new AppError(`Food item ${item.food_item_id} not found`, 404);
                }

                const foodItem = foodItems[0];

                if (!foodItem.is_available) {
                    throw new AppError(`Food item "${foodItem.name}" is not available`, 400);
                }

                const itemTotal = parseFloat(foodItem.price) * item.quantity;
                totalAmount += itemTotal;

                orderItems.push({
                    food_item_id: item.food_item_id,
                    quantity: item.quantity,
                    unit_price: foodItem.price,
                    total_price: itemTotal,
                    special_requests: item.special_requests || null
                });
            }

            // Calculate final amount
            const deliveryFee = parseFloat(restaurant.delivery_fee) || 0;
            const taxAmount = totalAmount * 0.05; // 5% tax
            const finalAmount = totalAmount + deliveryFee + taxAmount;

            // Generate order number
            const orderNumber = generateOrderNumber();

            // Create order
            const [orderResult] = await connection.execute(
                `INSERT INTO orders (
                    customer_id, restaurant_id, order_number, total_amount, 
                    delivery_fee, tax_amount, final_amount, payment_method, 
                    delivery_address, special_instructions, estimated_delivery_time
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [
                    customer_id, restaurant_id, orderNumber, totalAmount,
                    deliveryFee, taxAmount, finalAmount, payment_method,
                    JSON.stringify(delivery_address), special_instructions,
                    new Date(Date.now() + 45 * 60000) // 45 minutes from now
                ]
            );

            const orderId = orderResult.insertId;

            // Insert order items
            for (const item of orderItems) {
                await connection.execute(
                    'INSERT INTO order_items (order_id, food_item_id, quantity, unit_price, total_price, special_requests) VALUES (?, ?, ?, ?, ?, ?)',
                    [orderId, item.food_item_id, item.quantity, item.unit_price, item.total_price, item.special_requests]
                );

                // Update food item order count
                await connection.execute(
                    'UPDATE food_items SET total_orders = total_orders + ? WHERE id = ?',
                    [item.quantity, item.food_item_id]
                );
            }

            // Clear customer's cart for this restaurant
            await connection.execute(
                'DELETE ci FROM cart_items ci JOIN food_items fi ON ci.food_item_id = fi.id WHERE ci.customer_id = ? AND fi.restaurant_id = ?',
                [customer_id, restaurant_id]
            );

            await connection.commit();

            // Get complete order details
            const [orders] = await connection.execute(`
                SELECT o.*, 
                       JSON_OBJECT(
                           'id', r.id,
                           'name', r.name,
                           'phone', r.phone,
                           'logo_image', r.logo_image
                       ) as restaurant,
                       JSON_OBJECT(
                           'id', u.id,
                           'first_name', u.first_name,
                           'last_name', u.last_name,
                           'phone', u.phone
                       ) as customer
                FROM orders o
                JOIN restaurants r ON o.restaurant_id = r.id
                JOIN users u ON o.customer_id = u.id
                WHERE o.id = ?
            `, [orderId]);

            // Get order items
            const [items_data] = await connection.execute(`
                SELECT oi.*, fi.name, fi.image
                FROM order_items oi
                JOIN food_items fi ON oi.food_item_id = fi.id
                WHERE oi.order_id = ?
            `, [orderId]);

            // Emit real-time notification
            const io = req.app.get('socketio');
            io.to(`restaurant_${restaurant_id}`).emit('new_order', {
                orderId,
                orderNumber,
                customerName: `${req.user.first_name} ${req.user.last_name}`,
                totalAmount: finalAmount,
                itemCount: items.length
            });

            res.status(201).json({
                success: true,
                message: 'Order placed successfully',
                data: {
                    order: { ...orders[0], items: items_data }
                }
            });

        } catch (error) {
            await connection.rollback();
            throw error;
        } finally {
            connection.release();
        }
    })
);

// @route   GET /api/orders
// @desc    Get user's orders (customer or cook)
// @access  Private
router.get('/', authenticateToken, asyncHandler(async (req, res) => {
    const { page = 1, limit = 10, status } = req.query;
    const offset = (page - 1) * limit;

    let whereClause = '';
    let params = [];

    if (req.user.user_type === 'customer') {
        whereClause = 'WHERE o.customer_id = ?';
        params.push(req.user.id);
    } else if (req.user.user_type === 'cook') {
        // Get cook's restaurant
        const [restaurants] = await pool.execute(
            'SELECT id FROM restaurants WHERE cook_id = ?',
            [req.user.id]
        );

        if (restaurants.length === 0) {
            return res.json({
                success: true,
                data: { orders: [], totalCount: 0 }
            });
        }

        whereClause = 'WHERE o.restaurant_id = ?';
        params.push(restaurants[0].id);
    }

    if (status) {
        whereClause += whereClause ? ' AND o.status = ?' : 'WHERE o.status = ?';
        params.push(status);
    }

    // Get orders with restaurant and customer info
    const [orders] = await pool.execute(`
        SELECT o.*,
               JSON_OBJECT(
                   'id', r.id,
                   'name', r.name,
                   'logo_image', r.logo_image
               ) as restaurant,
               JSON_OBJECT(
                   'id', u.id,
                   'first_name', u.first_name,
                   'last_name', u.last_name,
                   'phone', u.phone
               ) as customer
        FROM orders o
        JOIN restaurants r ON o.restaurant_id = r.id
        JOIN users u ON o.customer_id = u.id
        ${whereClause}
        ORDER BY o.created_at DESC
        LIMIT ? OFFSET ?
    `, [...params, parseInt(limit), offset]);

    // Get total count
    const [countResult] = await pool.execute(`
        SELECT COUNT(*) as total
        FROM orders o
        ${whereClause}
    `, params);

    res.json({
        success: true,
        data: {
            orders,
            totalCount: countResult[0].total,
            currentPage: parseInt(page),
            totalPages: Math.ceil(countResult[0].total / limit)
        }
    });
}));

// @route   GET /api/orders/:id
// @desc    Get order details
// @access  Private
router.get('/:id', authenticateToken, asyncHandler(async (req, res) => {
    const orderId = req.params.id;

    // Get order with restaurant and customer info
    const [orders] = await pool.execute(`
        SELECT o.*,
               JSON_OBJECT(
                   'id', r.id,
                   'name', r.name,
                   'phone', r.phone,
                   'logo_image', r.logo_image
               ) as restaurant,
               JSON_OBJECT(
                   'id', u.id,
                   'first_name', u.first_name,
                   'last_name', u.last_name,
                   'phone', u.phone
               ) as customer
        FROM orders o
        JOIN restaurants r ON o.restaurant_id = r.id
        JOIN users u ON o.customer_id = u.id
        WHERE o.id = ?
    `, [orderId]);

    if (orders.length === 0) {
        throw new AppError('Order not found', 404);
    }

    const order = orders[0];

    // Check if user has permission to view this order
    if (req.user.user_type === 'customer' && order.customer_id !== req.user.id) {
        throw new AppError('Unauthorized to view this order', 403);
    }

    if (req.user.user_type === 'cook') {
        const [restaurants] = await pool.execute(
            'SELECT id FROM restaurants WHERE cook_id = ?',
            [req.user.id]
        );
        
        if (restaurants.length === 0 || order.restaurant_id !== restaurants[0].id) {
            throw new AppError('Unauthorized to view this order', 403);
        }
    }

    // Get order items
    const [items] = await pool.execute(`
        SELECT oi.*, fi.name, fi.image
        FROM order_items oi
        JOIN food_items fi ON oi.food_item_id = fi.id
        WHERE oi.order_id = ?
    `, [orderId]);

    res.json({
        success: true,
        data: {
            order: { ...order, items }
        }
    });
}));

// @route   PATCH /api/orders/:id/status
// @desc    Update order status
// @access  Private (Cook/Admin only)
router.patch('/:id/status', 
    authenticateToken,
    [
        body('status').isIn(['pending', 'confirmed', 'preparing', 'sent_to_delivery', 'delivered', 'cancelled']).withMessage('Valid status is required')
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

        const orderId = req.params.id;
        const { status } = req.body;

        // Get order details
        const [orders] = await pool.execute(
            'SELECT * FROM orders WHERE id = ?',
            [orderId]
        );

        if (orders.length === 0) {
            throw new AppError('Order not found', 404);
        }

        const order = orders[0];

        // Check permissions
        if (req.user.user_type === 'cook') {
            const [restaurants] = await pool.execute(
                'SELECT id FROM restaurants WHERE cook_id = ?',
                [req.user.id]
            );
            
            if (restaurants.length === 0 || order.restaurant_id !== restaurants[0].id) {
                throw new AppError('Unauthorized to update this order', 403);
            }
        } else if (req.user.user_type !== 'admin') {
            throw new AppError('Insufficient permissions', 403);
        }

        // Update order status
        const updateData = { status };
        if (status === 'delivered') {
            updateData.delivered_at = new Date();
        }

        const setClause = Object.keys(updateData).map(key => `${key} = ?`).join(', ');
        const values = Object.values(updateData);
        values.push(orderId);

        await pool.execute(
            `UPDATE orders SET ${setClause} WHERE id = ?`,
            values
        );

        // Emit real-time update
        const io = req.app.get('socketio');
        io.to(`user_${order.customer_id}`).emit('order_status_changed', {
            orderId,
            status,
            orderNumber: order.order_number
        });

        res.json({
            success: true,
            message: 'Order status updated successfully'
        });
    })
);

module.exports = router;
