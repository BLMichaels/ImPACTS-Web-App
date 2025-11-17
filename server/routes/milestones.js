const express = require('express');
const router = express.Router();
const { auth } = require('../middleware/auth');
const pool = require('../config/db');

// @route   GET api/milestones
// @desc    Get all milestone categories and items with user completion status
// @access  Private
router.get('/', auth, async (req, res) => {
    try {
        const result = await pool.query(
            `SELECT 
                mc.id as category_id,
                mc.name as category_name,
                mc.display_order as category_order,
                mi.id as item_id,
                mi.title,
                mi.description,
                mi.link_url,
                mi.link_text,
                mi.display_order as item_order,
                um.completed,
                um.completed_at,
                um.notes
            FROM milestone_categories mc
            LEFT JOIN milestone_items mi ON mc.id = mi.category_id
            LEFT JOIN user_milestones um ON mi.id = um.milestone_item_id AND um.user_id = $1
            ORDER BY mc.display_order, mi.display_order`,
            [req.user.id]
        );

        // Transform the flat results into a nested structure
        const categories = [];
        let currentCategory = null;

        result.rows.forEach(row => {
            if (!currentCategory || currentCategory.id !== row.category_id) {
                currentCategory = {
                    id: row.category_id,
                    name: row.category_name,
                    displayOrder: row.category_order,
                    items: []
                };
                categories.push(currentCategory);
            }

            if (row.item_id) {
                currentCategory.items.push({
                    id: row.item_id,
                    title: row.title,
                    description: row.description,
                    linkUrl: row.link_url,
                    linkText: row.link_text,
                    displayOrder: row.item_order,
                    completed: row.completed || false,
                    completedAt: row.completed_at,
                    notes: row.notes
                });
            }
        });

        res.json(categories);
    } catch (err) {
        console.error(err.message);
        res.status(500).json({ error: 'Server error' });
    }
});

// @route   POST api/milestones/:itemId/toggle
// @desc    Toggle completion status of a milestone item
// @access  Private
router.post('/:itemId/toggle', auth, async (req, res) => {
    const { notes } = req.body;
    
    try {
        const existingMilestone = await pool.query(
            'SELECT * FROM user_milestones WHERE user_id = $1 AND milestone_item_id = $2',
            [req.user.id, req.params.itemId]
        );

        let result;
        if (existingMilestone.rows.length === 0) {
            // Create new milestone completion
            result = await pool.query(
                `INSERT INTO user_milestones 
                (user_id, milestone_item_id, completed, completed_at, notes) 
                VALUES ($1, $2, true, CURRENT_TIMESTAMP, $3)
                RETURNING *`,
                [req.user.id, req.params.itemId, notes]
            );
        } else {
            // Toggle existing milestone completion
            const newCompletedState = !existingMilestone.rows[0].completed;
            result = await pool.query(
                `UPDATE user_milestones 
                SET completed = $1,
                    completed_at = CASE WHEN $1 = true THEN CURRENT_TIMESTAMP ELSE NULL END,
                    notes = $2
                WHERE user_id = $3 AND milestone_item_id = $4
                RETURNING *`,
                [newCompletedState, notes, req.user.id, req.params.itemId]
            );
        }

        res.json(result.rows[0]);
    } catch (err) {
        console.error(err.message);
        res.status(500).json({ error: 'Server error' });
    }
});

// @route   PUT api/milestones/:itemId/notes
// @desc    Update notes for a milestone item
// @access  Private
router.put('/:itemId/notes', auth, async (req, res) => {
    const { notes } = req.body;
    
    try {
        const result = await pool.query(
            `INSERT INTO user_milestones (user_id, milestone_item_id, notes)
            VALUES ($1, $2, $3)
            ON CONFLICT (user_id, milestone_item_id)
            DO UPDATE SET notes = $3
            RETURNING *`,
            [req.user.id, req.params.itemId, notes]
        );

        res.json(result.rows[0]);
    } catch (err) {
        console.error(err.message);
        res.status(500).json({ error: 'Server error' });
    }
});

module.exports = router; 