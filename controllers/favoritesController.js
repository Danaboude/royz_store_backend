const { pool } = require('../db/db');

// Get all favorite product IDs for the current user
exports.getFavorites = async (req, res) => {
  const userId = req.user.id;
  try {
    const [rows] = await pool.query('SELECT product_id FROM favorites WHERE user_id = ?', [userId]);
    res.json(rows.map(row => row.product_id));
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch favorites' });
  }
};

// Get favorited products with full details
exports.getFavoritedProducts = async (req, res) => {
  const userId = req.user.id;
  try {
    const [rows] = await pool.query(`
      SELECT 
        p.product_id,
        p.name,
        p.price,
        p.image_url,
        p.description,
        p.category_id,
        c.name_en as category_name,
        u.name as vendor_name,
        p.stock,
        COALESCE(AVG(r.rating), 0) as average_rating,
        COUNT(r.review_id) as review_count,
        p.is_new,
        p.is_best_selling,
        p.is_deal_offer,
        p.original_price,
        p.discount_percentage,
        CASE 
          WHEN p.discount_percentage IS NOT NULL 
          AND p.discount_start_date <= NOW() 
          AND (p.discount_end_date IS NULL OR p.discount_end_date >= NOW())
          THEN p.price * (1 - p.discount_percentage / 100)
          ELSE p.price
        END as final_price,
        CASE 
          WHEN p.discount_percentage IS NOT NULL 
          AND p.discount_start_date <= NOW() 
          AND (p.discount_end_date IS NULL OR p.discount_end_date >= NOW())
          THEN TRUE
          ELSE FALSE
        END as has_active_discount
      FROM favorites f
      JOIN products p ON f.product_id = p.product_id
      LEFT JOIN categories c ON p.category_id = c.category_id
      LEFT JOIN users u ON p.vendor_id = u.user_id
      LEFT JOIN reviews r ON p.product_id = r.product_id
      WHERE f.user_id = ?
      GROUP BY p.product_id, p.name, p.price, p.image_url, p.description, p.category_id, c.name_en, u.name, p.stock, p.is_new, p.is_best_selling, p.is_deal_offer, p.original_price, p.discount_percentage, p.discount_start_date, p.discount_end_date
      ORDER BY p.product_id DESC
    `, [userId]);
    res.json(rows);
  } catch (err) {
    console.error('Error fetching favorited products:', err);
    res.status(500).json({ error: 'Failed to fetch favorited products' });
  }
};

// Add a product to favorites
exports.addFavorite = async (req, res) => {
  const userId = req.user.id;
  const { product_id } = req.body;
  try {
    await pool.query('INSERT IGNORE INTO favorites (user_id, product_id) VALUES (?, ?)', [userId, product_id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to add favorite' });
  }
};

// Remove a product from favorites
exports.removeFavorite = async (req, res) => {
  const userId = req.user.id;
  const { product_id } = req.params;
  try {
    await pool.query('DELETE FROM favorites WHERE user_id = ? AND product_id = ?', [userId, product_id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to remove favorite' });
  }
}; 