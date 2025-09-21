const express = require('express');
const router = express.Router();
const { pool } = require('../db/db');

// GET /api/home - returns banners and categories
router.get('/', async (req, res) => {
  try {
    const [banners] = await pool.execute('SELECT * FROM banners WHERE is_active = 1 ORDER BY `order` ASC');
    const [categories] = await pool.execute('SELECT * FROM categories WHERE is_active = 1 ORDER BY category_id ASC');
    res.json({ banners, categories });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch home data', details: err.message });
  }
});

module.exports = router; 