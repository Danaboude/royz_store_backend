const { pool } = require('../db/db');
const fs = require('fs');
const path = require('path');

// Get all banners
exports.getBanners = async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT * FROM banners ORDER BY `order`, id');
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch banners' });
  }
};

// Add a new banner
exports.addBanner = async (req, res) => {
  const { image_url, link, order, is_active } = req.body;
  if (!image_url) {
    return res.status(400).json({ error: 'image_url is required' });
  }
  try {
    const [result] = await pool.query(
      'INSERT INTO banners (image_url, link, `order`, is_active) VALUES (?, ?, ?, ?)',
      [image_url, link, order || 0, is_active !== undefined ? is_active : 1]
    );
    const [rows] = await pool.query('SELECT * FROM banners WHERE id = ?', [result.insertId]);
    res.status(201).json(rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to add banner' });
  }
};

// Edit a banner
exports.editBanner = async (req, res) => {
  const { id } = req.params;
  const { image_url, link, order, is_active } = req.body;
  if (!image_url) {
    return res.status(400).json({ error: 'image_url is required' });
  }
  try {
    await pool.query(
      'UPDATE banners SET image_url=?, link=?, `order`=?, is_active=?, updated_at=NOW() WHERE id=?',
      [image_url, link, order || 0, is_active !== undefined ? is_active : 1, id]
    );
    const [rows] = await pool.query('SELECT * FROM banners WHERE id = ?', [id]);
    if (rows.length === 0) return res.status(404).json({ error: 'Banner not found' });
    res.json(rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to update banner' });
  }
};

// Delete a banner
exports.deleteBanner = async (req, res) => {
  const { id } = req.params;
  try {
    // Get the banner to find the image_url
    const [rows] = await pool.query('SELECT * FROM banners WHERE id=?', [id]);
    if (!rows.length) return res.status(404).json({ error: 'Banner not found' });
    const banner = rows[0];
    // Delete the banner from DB
    await pool.query('DELETE FROM banners WHERE id=?', [id]);
    // Remove the image file if it is a local upload
    if (banner.image_url && banner.image_url.includes('/uploads/banners/')) {
      const filename = banner.image_url.split('/uploads/banners/')[1];
      if (filename) {
        const filePath = path.join(__dirname, '../uploads/banners', filename);
        fs.unlink(filePath, err => {
          if (err && err.code !== 'ENOENT') console.error('Failed to delete banner image:', err);
        });
      }
    }
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to delete banner' });
  }
}; 