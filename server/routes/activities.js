const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const { auth, adminAuth } = require('../middleware/auth');
const pool = require('../config/db');

// @route   GET api/activities
// @desc    Get all activities for the current user
// @access  Private
router.get('/', auth, async (req, res) => {
    try {
        const activities = await pool.query(
            `SELECT a.*, ac.name as category_name, st.name as simulation_type_name, fft.name as feedback_form_type_name
             FROM activities a 
             LEFT JOIN activity_categories ac ON a.category_id = ac.id 
             LEFT JOIN simulation_types st ON a.simulation_type_id = st.id
             LEFT JOIN feedback_form_types fft ON a.feedback_forms_submitted_id = fft.id
             WHERE a.user_id = $1 
             ORDER BY a.date DESC, a.created_at DESC`,
            [req.user.id]
        );

        res.json(activities.rows);
    } catch (err) {
        console.error(err.message);
        res.status(500).json({ error: 'Server error' });
    }
});

// @route   POST api/activities
// @desc    Create a new activity
// @access  Private
router.post('/',
    [
        auth,
        [
            body('date').isDate(),
            body('activityNote').notEmpty(),
            body('categoryId').isInt(),
            body('hours').isFloat({ min: 0, max: 24 }),
            body('simulationTypeId').optional().isInt(),
            body('simulationParticipants').optional().isInt({ min: 0, max: 100 }),
            body('feedbackFormsSubmittedId').optional().isInt(),
            body('notes').optional()
        ]
    ],
    async (req, res) => {
        try {
            const errors = validationResult(req);
            if (!errors.isEmpty()) {
                return res.status(400).json({ errors: errors.array() });
            }

            const {
                date,
                activityNote,
                categoryId,
                hours,
                simulationTypeId,
                simulationParticipants,
                feedbackFormsSubmittedId,
                notes
            } = req.body;

            const newActivity = await pool.query(
                `INSERT INTO activities 
                (user_id, date, activity_note, category_id, hours, simulation_type_id, 
                simulation_participants, feedback_forms_submitted_id, notes) 
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) 
                RETURNING *`,
                [
                    req.user.id,
                    date,
                    activityNote,
                    categoryId,
                    hours,
                    simulationTypeId,
                    simulationParticipants,
                    feedbackFormsSubmittedId,
                    notes
                ]
            );

            res.status(201).json(newActivity.rows[0]);
        } catch (err) {
            console.error(err.message);
            res.status(500).json({ error: 'Server error' });
        }
    }
);

// @route   PUT api/activities/:id
// @desc    Update an activity
// @access  Private
router.put('/:id',
    [
        auth,
        [
            body('date').optional().isDate(),
            body('activityNote').optional().notEmpty(),
            body('categoryId').optional().isInt(),
            body('hours').optional().isFloat({ min: 0, max: 24 }),
            body('simulationTypeId').optional().isInt(),
            body('simulationParticipants').optional().isInt({ min: 0, max: 100 }),
            body('feedbackFormsSubmittedId').optional().isInt(),
            body('notes').optional()
        ]
    ],
    async (req, res) => {
        try {
            const errors = validationResult(req);
            if (!errors.isEmpty()) {
                return res.status(400).json({ errors: errors.array() });
            }

            const activity = await pool.query(
                'SELECT * FROM activities WHERE id = $1 AND user_id = $2',
                [req.params.id, req.user.id]
            );

            if (activity.rows.length === 0) {
                return res.status(404).json({ error: 'Activity not found' });
            }

            const {
                date,
                activityNote,
                categoryId,
                hours,
                simulationTypeId,
                simulationParticipants,
                feedbackFormsSubmittedId,
                notes
            } = req.body;

            const updatedActivity = await pool.query(
                `UPDATE activities 
                SET date = COALESCE($1, date),
                    activity_note = COALESCE($2, activity_note),
                    category_id = COALESCE($3, category_id),
                    hours = COALESCE($4, hours),
                    simulation_type_id = COALESCE($5, simulation_type_id),
                    simulation_participants = COALESCE($6, simulation_participants),
                    feedback_forms_submitted_id = COALESCE($7, feedback_forms_submitted_id),
                    notes = COALESCE($8, notes)
                WHERE id = $9 AND user_id = $10
                RETURNING *`,
                [
                    date,
                    activityNote,
                    categoryId,
                    hours,
                    simulationTypeId,
                    simulationParticipants,
                    feedbackFormsSubmittedId,
                    notes,
                    req.params.id,
                    req.user.id
                ]
            );

            res.json(updatedActivity.rows[0]);
        } catch (err) {
            console.error(err.message);
            res.status(500).json({ error: 'Server error' });
        }
    }
);

// @route   DELETE api/activities/:id
// @desc    Delete an activity
// @access  Private
router.delete('/:id', auth, async (req, res) => {
    try {
        const activity = await pool.query(
            'DELETE FROM activities WHERE id = $1 AND user_id = $2 RETURNING *',
            [req.params.id, req.user.id]
        );

        if (activity.rows.length === 0) {
            return res.status(404).json({ error: 'Activity not found' });
        }

        res.json({ message: 'Activity removed' });
    } catch (err) {
        console.error(err.message);
        res.status(500).json({ error: 'Server error' });
    }
});

// @route   GET api/activities/categories
// @desc    Get all activity categories
// @access  Private
router.get('/categories', auth, async (req, res) => {
    try {
        const categories = await pool.query('SELECT * FROM activity_categories ORDER BY name');
        res.json(categories.rows);
    } catch (err) {
        console.error(err.message);
        res.status(500).json({ error: 'Server error' });
    }
});

// @route   GET api/activities/simulation-types
// @desc    Get all simulation types
// @access  Private
router.get('/simulation-types', auth, async (req, res) => {
    try {
        const simulationTypes = await pool.query('SELECT * FROM simulation_types ORDER BY name');
        res.json(simulationTypes.rows);
    } catch (err) {
        console.error(err.message);
        res.status(500).json({ error: 'Server error' });
    }
});

// @route   GET api/activities/feedback-form-types
// @desc    Get all feedback form types
// @access  Private
router.get('/feedback-form-types', auth, async (req, res) => {
    try {
        const feedbackFormTypes = await pool.query('SELECT * FROM feedback_form_types ORDER BY name');
        res.json(feedbackFormTypes.rows);
    } catch (err) {
        console.error(err.message);
        res.status(500).json({ error: 'Server error' });
    }
});

module.exports = router; 