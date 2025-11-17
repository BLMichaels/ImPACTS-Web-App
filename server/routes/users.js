const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { body, validationResult } = require('express-validator');
const { auth, adminAuth } = require('../middleware/auth');
const pool = require('../config/db');

// @route   POST api/users/register
// @desc    Register a user
// @access  Public
router.post('/register',
    [
        body('email').isEmail(),
        body('password').isLength({ min: 6 }),
        body('firstName').notEmpty(),
        body('lastName').notEmpty(),
        body('hospitalName').optional()
    ],
    async (req, res) => {
        try {
            const errors = validationResult(req);
            if (!errors.isEmpty()) {
                return res.status(400).json({ errors: errors.array() });
            }

            const { email, password, firstName, lastName, hospitalName } = req.body;

            // Check if user exists
            const userExists = await pool.query(
                'SELECT * FROM users WHERE email = $1',
                [email]
            );

            if (userExists.rows.length > 0) {
                return res.status(400).json({ error: 'User already exists' });
            }

            // Hash password
            const salt = await bcrypt.genSalt(10);
            const hashedPassword = await bcrypt.hash(password, salt);

            // Create user
            const newUser = await pool.query(
                'INSERT INTO users (email, password_hash, first_name, last_name, hospital_name) VALUES ($1, $2, $3, $4, $5) RETURNING id, email, first_name, last_name, hospital_name, role',
                [email, hashedPassword, firstName, lastName, hospitalName]
            );

            // Create JWT token
            const token = jwt.sign(
                { id: newUser.rows[0].id, role: newUser.rows[0].role },
                process.env.JWT_SECRET,
                { expiresIn: '24h' }
            );

            res.status(201).json({
                token,
                user: newUser.rows[0]
            });
        } catch (err) {
            console.error(err.message);
            res.status(500).json({ error: 'Server error' });
        }
    }
);

// @route   POST api/users/login
// @desc    Login user
// @access  Public
router.post('/login',
    [
        body('email').isEmail(),
        body('password').exists()
    ],
    async (req, res) => {
        try {
            const errors = validationResult(req);
            if (!errors.isEmpty()) {
                return res.status(400).json({ errors: errors.array() });
            }

            const { email, password } = req.body;

            // Check if user exists
            const user = await pool.query(
                'SELECT * FROM users WHERE email = $1',
                [email]
            );

            if (user.rows.length === 0) {
                return res.status(400).json({ error: 'Invalid credentials' });
            }

            // Verify password
            const isMatch = await bcrypt.compare(password, user.rows[0].password_hash);
            if (!isMatch) {
                return res.status(400).json({ error: 'Invalid credentials' });
            }

            // Create JWT token
            const token = jwt.sign(
                { id: user.rows[0].id, role: user.rows[0].role },
                process.env.JWT_SECRET,
                { expiresIn: '24h' }
            );

            res.json({
                token,
                user: {
                    id: user.rows[0].id,
                    email: user.rows[0].email,
                    firstName: user.rows[0].first_name,
                    lastName: user.rows[0].last_name,
                    hospitalName: user.rows[0].hospital_name,
                    role: user.rows[0].role
                }
            });
        } catch (err) {
            console.error(err.message);
            res.status(500).json({ error: 'Server error' });
        }
    }
);

// @route   GET api/users/me
// @desc    Get current user
// @access  Private
router.get('/me', auth, async (req, res) => {
    try {
        const user = await pool.query(
            'SELECT id, email, first_name, last_name, hospital_name, role FROM users WHERE id = $1',
            [req.user.id]
        );

        if (user.rows.length === 0) {
            return res.status(404).json({ error: 'User not found' });
        }

        res.json(user.rows[0]);
    } catch (err) {
        console.error(err.message);
        res.status(500).json({ error: 'Server error' });
    }
});

module.exports = router; 