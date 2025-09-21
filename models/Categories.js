const { pool } = require('../db/db');

const Categories = {
  async getAll() {
    const [rows] = await pool.query('SELECT * FROM categories ORDER BY name_en');
    return rows;
  },
  async getById(id) {
    const [rows] = await pool.query('SELECT * FROM categories WHERE category_id = ?', [id]);
    return rows[0];
  },
  async create({ name_en, name_ar, description_en, description_ar }) {
    const [result] = await pool.query(
      'INSERT INTO categories (name_en, name_ar, description_en, description_ar) VALUES (?, ?, ?, ?)',
      [name_en, name_ar, description_en, description_ar]
    );
    return result.insertId;
  },
  async update(id, { name_en, name_ar, description_en, description_ar }) {
    const [result] = await pool.query(
      'UPDATE categories SET name_en = ?, name_ar = ?, description_en = ?, description_ar = ? WHERE category_id = ?',
      [name_en, name_ar, description_en, description_ar, id]
    );
    return result.affectedRows;
  },
  async delete(id) {
    const [result] = await pool.query('DELETE FROM categories WHERE category_id = ?', [id]);
    return result.affectedRows;
  },
};

module.exports = Categories; 