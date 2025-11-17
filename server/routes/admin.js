const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const { adminAuth } = require('../middleware/auth');
const pool = require('../config/db');

// @route   GET api/admin/categories
// @desc    Get all activity categories (admin only)
// @access  Private/Admin
router.get('/categories', adminAuth, async (req, res) => {
    try {
        const categories = await pool.query('SELECT * FROM activity_categories ORDER BY name');
        res.json(categories.rows);
    } catch (err) {
        console.error(err.message);
        res.status(500).json({ error: 'Server error' });
    }
});

// @route   POST api/admin/categories
// @desc    Create a new activity category (admin only)
// @access  Private/Admin
router.post('/categories',
    [
        adminAuth,
        [body('name').notEmpty().trim()]
    ],
    async (req, res) => {
        try {
            const errors = validationResult(req);
            if (!errors.isEmpty()) {
                return res.status(400).json({ errors: errors.array() });
            }

            const { name } = req.body;

            const newCategory = await pool.query(
                'INSERT INTO activity_categories (name) VALUES ($1) RETURNING *',
                [name]
            );

            res.status(201).json(newCategory.rows[0]);
        } catch (err) {
            console.error(err.message);
            res.status(500).json({ error: 'Server error' });
        }
    }
);

// @route   PUT api/admin/categories/:id
// @desc    Update an activity category (admin only)
// @access  Private/Admin
router.put('/categories/:id',
    [
        adminAuth,
        [body('name').notEmpty().trim()]
    ],
    async (req, res) => {
        try {
            const errors = validationResult(req);
            if (!errors.isEmpty()) {
                return res.status(400).json({ errors: errors.array() });
            }

            const { name } = req.body;

            const updatedCategory = await pool.query(
                'UPDATE activity_categories SET name = $1 WHERE id = $2 RETURNING *',
                [name, req.params.id]
            );

            if (updatedCategory.rows.length === 0) {
                return res.status(404).json({ error: 'Category not found' });
            }

            res.json(updatedCategory.rows[0]);
        } catch (err) {
            console.error(err.message);
            res.status(500).json({ error: 'Server error' });
        }
    }
);

// @route   DELETE api/admin/categories/:id
// @desc    Delete an activity category (admin only)
// @access  Private/Admin
router.delete('/categories/:id', adminAuth, async (req, res) => {
    try {
        const category = await pool.query(
            'DELETE FROM activity_categories WHERE id = $1 RETURNING *',
            [req.params.id]
        );

        if (category.rows.length === 0) {
            return res.status(404).json({ error: 'Category not found' });
        }

        res.json({ message: 'Category removed' });
    } catch (err) {
        console.error(err.message);
        res.status(500).json({ error: 'Server error' });
    }
});

// @route   GET api/admin/simulation-types
// @desc    Get all simulation types (admin only)
// @access  Private/Admin
router.get('/simulation-types', adminAuth, async (req, res) => {
    try {
        const simulationTypes = await pool.query('SELECT * FROM simulation_types ORDER BY name');
        res.json(simulationTypes.rows);
    } catch (err) {
        console.error(err.message);
        res.status(500).json({ error: 'Server error' });
    }
});

// @route   POST api/admin/simulation-types
// @desc    Create a new simulation type (admin only)
// @access  Private/Admin
router.post('/simulation-types',
    [
        adminAuth,
        [body('name').notEmpty().trim()]
    ],
    async (req, res) => {
        try {
            const errors = validationResult(req);
            if (!errors.isEmpty()) {
                return res.status(400).json({ errors: errors.array() });
            }

            const { name } = req.body;

            const newSimulationType = await pool.query(
                'INSERT INTO simulation_types (name) VALUES ($1) RETURNING *',
                [name]
            );

            res.status(201).json(newSimulationType.rows[0]);
        } catch (err) {
            console.error(err.message);
            res.status(500).json({ error: 'Server error' });
        }
    }
);

// @route   PUT api/admin/simulation-types/:id
// @desc    Update a simulation type (admin only)
// @access  Private/Admin
router.put('/simulation-types/:id',
    [
        adminAuth,
        [body('name').notEmpty().trim()]
    ],
    async (req, res) => {
        try {
            const errors = validationResult(req);
            if (!errors.isEmpty()) {
                return res.status(400).json({ errors: errors.array() });
            }

            const { name } = req.body;

            const updatedSimulationType = await pool.query(
                'UPDATE simulation_types SET name = $1 WHERE id = $2 RETURNING *',
                [name, req.params.id]
            );

            if (updatedSimulationType.rows.length === 0) {
                return res.status(404).json({ error: 'Simulation type not found' });
            }

            res.json(updatedSimulationType.rows[0]);
        } catch (err) {
            console.error(err.message);
            res.status(500).json({ error: 'Server error' });
        }
    }
);

// @route   DELETE api/admin/simulation-types/:id
// @desc    Delete a simulation type (admin only)
// @access  Private/Admin
router.delete('/simulation-types/:id', adminAuth, async (req, res) => {
    try {
        const simulationType = await pool.query(
            'DELETE FROM simulation_types WHERE id = $1 RETURNING *',
            [req.params.id]
        );

        if (simulationType.rows.length === 0) {
            return res.status(404).json({ error: 'Simulation type not found' });
        }

        res.json({ message: 'Simulation type removed' });
    } catch (err) {
        console.error(err.message);
        res.status(500).json({ error: 'Server error' });
    }
});

module.exports = router; 