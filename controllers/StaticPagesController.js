// Static Pages Controller (DEPRECATED)
// All logic for static_pages has been removed. Use site_settings endpoints instead.

// This file is intentionally left blank to prevent accidental usage of static_pages logic.

const { pool } = require('../db/db');

async function getAllPages(req, res) {
    try {
        const [rows] = await pool.query('SELECT * FROM static_pages ORDER BY page_id');
        res.json(rows);
    } catch (err) {
        console.error(err);
        res.status(500).json({error:'Server Error', details: err?.message});
    }
}

async function getPageByKey(req, res) {
    const { key } = req.params;

    try {
        const [rows] = await pool.query('SELECT * FROM static_pages WHERE page_key = ?', [key]);
        
        if (rows.length) res.json(rows[0]);
        else res.status(404).json({error:'Page not found'});
    } catch (err) {
        console.error(err);
        res.status(500).json({error:'Server Error', details: err?.message});
    }
}

async function getPageById(req, res) {
    const { id } = req.params;

    try {
        const [rows] = await pool.query('SELECT * FROM static_pages WHERE page_id = ?', [id]);
        
        if (rows.length) res.json(rows[0]);
        else res.status(404).json({error:'Page not found'});
    } catch (err) {
        console.error(err);
        res.status(500).json({error:'Server Error', details: err?.message});
    }
}

async function createPage(req, res) {
    const { title, content, page_key } = req.body;

    if (!title || !content || !page_key) {
        return res.status(400).json({ error: 'Title, content, and page_key are required' });
    }

    try {
        const [result] = await pool.query(
            'INSERT INTO static_pages (title, content, page_key) VALUES (?, ?, ?)',
            [title, content, page_key]
        );
        res.status(201).json({ 
            message: 'Page created successfully', 
            page_id: result.insertId 
        });
    } catch (err) {
        console.error(err);
        if (err.code === 'ER_DUP_ENTRY') {
            res.status(400).json({error:'Page key already exists'});
        } else {
            res.status(500).json({error:'Server Error', details: err?.message});
        }
    }
}

async function updatePage(req, res) {
    const { id } = req.params;
    const { title, content, page_key } = req.body;

    try {
        let updateFields = [];
        let params = [];

        if (title) {
            updateFields.push('title = ?');
            params.push(title);
        }
        if (content) {
            updateFields.push('content = ?');
            params.push(content);
        }
        if (page_key) {
            updateFields.push('page_key = ?');
            params.push(page_key);
        }

        if (updateFields.length === 0) {
            return res.status(400).json({ error: 'No fields to update' });
        }

        params.push(id);

        const [result] = await pool.query(
            `UPDATE static_pages SET ${updateFields.join(', ')} WHERE page_id = ?`,
            params
        );

        if (result.affectedRows === 0) {
            return res.status(404).json({ error: 'Page not found' });
        }

        res.json({ message: 'Page updated successfully' });
    } catch (err) {
        console.error(err);
        if (err.code === 'ER_DUP_ENTRY') {
            res.status(400).json({error:'Page key already exists'});
        } else {
            res.status(500).json({error:'Server Error', details: err?.message});
        }
    }
}

async function deletePage(req, res) {
    const { id } = req.params;

    try {
        const [result] = await pool.query('DELETE FROM static_pages WHERE page_id = ?', [id]);
        
        if (result.affectedRows === 0) {
            return res.status(404).json({ error: 'Page not found' });
        }

        res.json({ message: 'Page deleted successfully' });
    } catch (err) {
        console.error(err);
        res.status(500).json({error:'Server Error', details: err?.message});
    }
}

module.exports = { 
    getAllPages, 
    getPageByKey, 
    getPageById, 
    createPage, 
    updatePage, 
    deletePage 
}; 
