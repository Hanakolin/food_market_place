const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { body, validationResult } = require('express-validator');
const { pool } = require('../config/database');
const { asyncHandler, AppError } = require('../middleware/errorHandler');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

// Validation rules
const registerValidation = [
    body('email').isEmail().normalizeEmail().withMessage('Valid email is required'),
    body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
    body('first_name').isLength({ min: 2 }).trim().withMessage('First name must be at least 2 characters'),
    body('last_name').isLength({ min: 2 }).trim().withMessage('Last name must be at least 2 characters'),
    body('user_type').isIn(['customer', 'cook']).withMessage('User type must be either customer or cook'),
    body('phone').optional().isMobilePhone().withMessage('Valid phone number is required')
];

const loginValidation = [
    body('email').isEmail().normalizeEmail().withMessage('Valid email is required'),
    body('password').notEmpty().withMessage('Password is required')
];

// Helper function to generate JWT token
const generateToken = (userId) => {
    return jwt.sign({ userId }, process.env.JWT_SECRET, {
        expiresIn: process.env.JWT_EXPIRES_IN
    });
};

// @route   POST /api/auth/register
// @desc    Register a new user
// @access  Public
router.post('/register', registerValidation, asyncHandler(async (req, res) => {
    // Check validation errors
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({
            success: false,
            message: 'Validation failed',
            errors: errors.array()
        });
    }

    const { email, password, first_name, last_name, user_type, phone } = req.body;

    // Check if user already exists
    const [existingUsers] = await pool.execute(
        'SELECT id FROM users WHERE email = ?',
        [email]
    );

    if (existingUsers.length > 0) {
        return res.status(400).json({
            success: false,
            message: 'User already exists with this email'
        });
    }

    // Hash password
    const saltRounds = 10;
    const hashedPassword = await bcrypt.hash(password, saltRounds);

    // Insert new user
    const [result] = await pool.execute(
        'INSERT INTO users (email, password, first_name, last_name, user_type, phone) VALUES (?, ?, ?, ?, ?, ?)',
        [email, hashedPassword, first_name, last_name, user_type, phone]
    );

    const userId = result.insertId;

    // Generate JWT token
    const token = generateToken(userId);

    // Get user data (without password)
    const [users] = await pool.execute(
        'SELECT id, email, first_name, last_name, user_type, phone, profile_image, created_at FROM users WHERE id = ?',
        [userId]
    );

    res.status(201).json({
        success: true,
        message: 'User registered successfully',
        data: {
            user: users[0],
            token
        }
    });
}));

// @route   POST /api/auth/login
// @desc    Login user
// @access  Public
router.post('/login', loginValidation, asyncHandler(async (req, res) => {
    // Check validation errors
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({
            success: false,
            message: 'Validation failed',
            errors: errors.array()
        });
    }

    const { email, password } = req.body;

    // Get user from database
    const [users] = await pool.execute(
        'SELECT id, email, password, first_name, last_name, user_type, phone, profile_image, is_active FROM users WHERE email = ?',
        [email]
    );

    if (users.length === 0) {
        return res.status(401).json({
            success: false,
            message: 'Invalid email or password'
        });
    }

    const user = users[0];

    // Check if user is active
    if (!user.is_active) {
        return res.status(401).json({
            success: false,
            message: 'Account has been deactivated'
        });
    }

    // Verify password
    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
        return res.status(401).json({
            success: false,
            message: 'Invalid email or password'
        });
    }

    // Generate JWT token
    const token = generateToken(user.id);

    // Remove password from user object
    delete user.password;

    res.json({
        success: true,
        message: 'Login successful',
        data: {
            user,
            token
        }
    });
}));

// @route   GET /api/auth/profile
// @desc    Get current user profile
// @access  Private
router.get('/profile', authenticateToken, asyncHandler(async (req, res) => {
    const [users] = await pool.execute(
        'SELECT id, email, first_name, last_name, user_type, phone, profile_image, email_verified, created_at FROM users WHERE id = ?',
        [req.user.id]
    );

    if (users.length === 0) {
        throw new AppError('User not found', 404);
    }

    res.json({
        success: true,
        data: { user: users[0] }
    });
}));

// @route   PUT /api/auth/profile
// @desc    Update user profile
// @access  Private
router.put('/profile', 
    authenticateToken,
    [
        body('first_name').optional().isLength({ min: 2 }).trim(),
        body('last_name').optional().isLength({ min: 2 }).trim(),
        body('phone').optional().isMobilePhone()
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

        const { first_name, last_name, phone } = req.body;
        const updates = {};
        const values = [];

        if (first_name) {
            updates.first_name = first_name;
            values.push(first_name);
        }
        if (last_name) {
            updates.last_name = last_name;
            values.push(last_name);
        }
        if (phone) {
            updates.phone = phone;
            values.push(phone);
        }

        if (Object.keys(updates).length === 0) {
            return res.status(400).json({
                success: false,
                message: 'No fields to update'
            });
        }

        const setClause = Object.keys(updates).map(key => `${key} = ?`).join(', ');
        values.push(req.user.id);

        await pool.execute(
            `UPDATE users SET ${setClause} WHERE id = ?`,
            values
        );

        // Get updated user data
        const [users] = await pool.execute(
            'SELECT id, email, first_name, last_name, user_type, phone, profile_image, email_verified, created_at FROM users WHERE id = ?',
            [req.user.id]
        );

        res.json({
            success: true,
            message: 'Profile updated successfully',
            data: { user: users[0] }
        });
    })
);

// @route   POST /api/auth/change-password
// @desc    Change user password
// @access  Private
router.post('/change-password',
    authenticateToken,
    [
        body('current_password').notEmpty().withMessage('Current password is required'),
        body('new_password').isLength({ min: 6 }).withMessage('New password must be at least 6 characters')
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

        const { current_password, new_password } = req.body;

        // Get current user with password
        const [users] = await pool.execute(
            'SELECT password FROM users WHERE id = ?',
            [req.user.id]
        );

        const user = users[0];

        // Verify current password
        const isCurrentPasswordValid = await bcrypt.compare(current_password, user.password);
        if (!isCurrentPasswordValid) {
            return res.status(400).json({
                success: false,
                message: 'Current password is incorrect'
            });
        }

        // Hash new password
        const saltRounds = 10;
        const hashedNewPassword = await bcrypt.hash(new_password, saltRounds);

        // Update password
        await pool.execute(
            'UPDATE users SET password = ? WHERE id = ?',
            [hashedNewPassword, req.user.id]
        );

        res.json({
            success: true,
            message: 'Password changed successfully'
        });
    })
);

// @route   POST /api/auth/logout
// @desc    Logout user (client-side token removal)
// @access  Private
router.post('/logout', authenticateToken, (req, res) => {
    // In a stateless JWT system, logout is handled client-side by removing the token
    // This endpoint can be used for logging purposes or token blacklisting in the future
    res.json({
        success: true,
        message: 'Logged out successfully'
    });
});

module.exports = router;
