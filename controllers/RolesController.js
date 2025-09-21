// Roles Controller 

const { pool } = require('../db/db');

async function getAllRoles(req, res) {
    try {
        const [rows] = await pool.query('SELECT * FROM roles ORDER BY role_id');
        res.json(rows);
    } catch (err) {
        console.error(err);
        res.status(500).json({error:'Server Error', details: err?.message});
    }
}

async function getRoleById(req, res) {
    const { id } = req.params;

    try {
        const [rows] = await pool.query('SELECT * FROM roles WHERE role_id = ?', [id]);
        
        if (rows.length) res.json(rows[0]);
        else res.status(404).json({error:'Role not found'});
    } catch (err) {
        console.error(err);
        res.status(500).json({error:'Server Error', details: err?.message});
    }
}

async function createRole(req, res) {
    const { role_name } = req.body;

    if (!role_name) {
        return res.status(400).json({ error: 'Role name is required' });
    }

    try {
        const [result] = await pool.query(
            'INSERT INTO roles (role_name) VALUES (?)',
            [role_name]
        );
        res.status(201).json({ 
            message: 'Role created successfully', 
            role_id: result.insertId 
        });
    } catch (err) {
        console.error(err);
        if (err.code === 'ER_DUP_ENTRY') {
            res.status(400).json({error:'Role name already exists'});
        } else {
            res.status(500).json({error:'Server Error', details: err?.message});
        }
    }
}

async function updateRole(req, res) {
    const { id } = req.params;
    const { role_name } = req.body;

    if (!role_name) {
        return res.status(400).json({ error: 'Role name is required' });
    }

    try {
        const [result] = await pool.query(
            'UPDATE roles SET role_name = ? WHERE role_id = ?',
            [role_name, id]
        );

        if (result.affectedRows === 0) {
            return res.status(404).json({ error: 'Role not found' });
        }

        res.json({ message: 'Role updated successfully' });
    } catch (err) {
        console.error(err);
        if (err.code === 'ER_DUP_ENTRY') {
            res.status(400).json({error:'Role name already exists'});
        } else {
            res.status(500).json({error:'Server Error', details: err?.message});
        }
    }
}

async function deleteRole(req, res) {
    const { id } = req.params;

    try {
        // Check if role is being used by any users
        const [users] = await pool.query(
            'SELECT COUNT(*) as count FROM users WHERE role_id = ?',
            [id]
        );

        if (users[0].count > 0) {
            return res.status(400).json({ 
                error: 'Cannot delete role that is assigned to users' 
            });
        }

        const [result] = await pool.query('DELETE FROM roles WHERE role_id = ?', [id]);
        
        if (result.affectedRows === 0) {
            return res.status(404).json({ error: 'Role not found' });
        }

        res.json({ message: 'Role deleted successfully' });
    } catch (err) {
        console.error(err);
        res.status(500).json({error:'Server Error', details: err?.message});
    }
}

module.exports = { 
    getAllRoles, 
    getRoleById, 
    createRole, 
    updateRole, 
    deleteRole 
}; 