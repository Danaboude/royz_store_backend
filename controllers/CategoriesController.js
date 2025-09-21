// Categories Controller 

const { pool } = require('../db/db');

async function getAllCategories(req, res) {
    try {
        const { search = '', page = 1, limit = 20 } = req.query;
        const offset = (parseInt(page) - 1) * parseInt(limit);
        let where = '';
        let params = [];
        if (search) {
            where = 'WHERE name_en LIKE ? OR name_ar LIKE ?';
            params.push(`%${search}%`, `%${search}%`);
        }
        // Get total count for pagination
        const [countRows] = await pool.query(
            `SELECT COUNT(*) as total FROM categories ${where}`,
            params
        );
        // Get paginated categories
        const [rows] = await pool.query(
            `SELECT * FROM categories ${where} ORDER BY \`order\` ASC, name_en ASC LIMIT ? OFFSET ?`,
            [...params, parseInt(limit), offset]
        );
        res.json({
            data: rows,
            total: countRows[0].total,
            page: parseInt(page),
            limit: parseInt(limit)
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({error:'Server Error', details: err?.message});
    }
}

async function getCategoryById(req, res) {
    const { id } = req.params;
    try {
        const [rows] = await pool.query('SELECT * FROM categories WHERE category_id = ?', [id]);
        if (rows.length) res.json(rows[0]);
        else res.status(404).json({error:'Category not found'});
    } catch (err) {
        console.error(err);
        res.status(500).json({error:'Server Error', details: err?.message});
    }
}

async function createCategory(req, res) {
    const { name_en, name_ar, description_en, description_ar } = req.body;

    if (!name_en || !name_ar) {
        return res.status(400).json({ error: 'Both English and Arabic category names are required' });
    }

    try {
        const [result] = await pool.query(
            'INSERT INTO categories (name_en, name_ar, description_en, description_ar) VALUES (?, ?, ?, ?)',
            [name_en, name_ar, description_en, description_ar]
        );
        res.status(201).json({ 
            message: 'Category created successfully', 
            category_id: result.insertId 
        });
    } catch (err) {
        console.error(err);
        if (err.code === 'ER_DUP_ENTRY') {
            res.status(400).json({error:'Category name already exists'});
        } else {
            res.status(500).json({error:'Server Error', details: err?.message});
        }
    }
}

async function updateCategory(req, res) {
    const { id } = req.params;
    const { name_en, name_ar, description_en, description_ar } = req.body;

    if (!name_en || !name_ar) {
        return res.status(400).json({ error: 'Both English and Arabic category names are required' });
    }

    try {
        const [result] = await pool.query(
            'UPDATE categories SET name_en = ?, name_ar = ?, description_en = ?, description_ar = ? WHERE category_id = ?',
            [name_en, name_ar, description_en, description_ar, id]
        );

        if (result.affectedRows === 0) {
            return res.status(404).json({ error: 'Category not found' });
        }

        res.json({ message: 'Category updated successfully' });
    } catch (err) {
        console.error(err);
        if (err.code === 'ER_DUP_ENTRY') {
            res.status(400).json({error:'Category name already exists'});
        } else {
            res.status(500).json({error:'Server Error', details: err?.message});
        }
    }
}

async function deleteCategory(req, res) {
    const { id } = req.params;

    try {
        // Check if category is being used by any products
        const [products] = await pool.query(
            'SELECT COUNT(*) as count FROM products WHERE category_id = ? AND deleted = 0',
            [id]
        );

        if (products[0].count > 0) {
            return res.status(400).json({ 
                error: 'Cannot delete category that has associated products' 
            });
        }

        const [result] = await pool.query('DELETE FROM categories WHERE category_id = ?', [id]);
        
        if (result.affectedRows === 0) {
            return res.status(404).json({ error: 'Category not found' });
        }

        res.json({ message: 'Category deleted successfully' });
    } catch (err) {
        console.error(err);
        res.status(500).json({error:'Server Error', details: err?.message});
    }
}

// Reorder categories (admin only)
async function reorderCategories(req, res) {
    // Debug log for incoming payload
            // Expects: { order: [category_id1, category_id2, ...] }
    const { order } = req.body;
    if (!Array.isArray(order)) {
        return res.status(400).json({ error: 'Order must be an array of category IDs', received: req.body });
    }
    let conn;
    try {
        conn = await pool.getConnection();
        await conn.beginTransaction();
        for (let i = 0; i < order.length; i++) {
            await conn.query('UPDATE categories SET `order` = ? WHERE category_id = ?', [i, order[i]]);
        }
        await conn.commit();
        res.json({ message: 'Categories reordered successfully' });
    } catch (err) {
        if (conn) await conn.rollback();
        console.error(err);
        res.status(500).json({ error: 'Server Error', details: err?.message });
    } finally {
        if (conn) conn.release();
    }
}

module.exports = { 
    getAllCategories, 
    getCategoryById, 
    createCategory, 
    updateCategory, 
    deleteCategory,
    reorderCategories
}; 