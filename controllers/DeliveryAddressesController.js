// Delivery Addresses Controller 

const { pool } = require('../db/db');

async function getDeliveryAddresses(req, res) {
    const customer_id = req.user.id;

    try {
        const [rows] = await pool.query(
            'SELECT * FROM delivery_addresses WHERE customer_id = ? ORDER BY address_id',
            [customer_id]
        );
        res.json(rows);
    } catch (err) {
        console.error(err);
        res.status(500).json({error:'Server Error', details: err?.message});
    }
}

async function getDeliveryAddressById(req, res) {
    const { id } = req.params;
    const customer_id = req.user.id;

    try {
        const [rows] = await pool.query(
            'SELECT * FROM delivery_addresses WHERE address_id = ? AND customer_id = ?',
            [id, customer_id]
        );
        
        if (rows.length) res.json(rows[0]);
        else res.status(404).json({error:'Delivery address not found'});
    } catch (err) {
        console.error(err);
        res.status(500).json({error:'Server Error', details: err?.message});
    }
}

async function createDeliveryAddress(req, res) {
                const customer_id = req.user.id;
    const { address, phone } = req.body;

    if (!address) {
        return res.status(400).json({ error: 'Address is required' });
    }

    try {
        const [result] = await pool.query(
            'INSERT INTO delivery_addresses (customer_id, address, phone) VALUES (?, ?, ?)',
            [customer_id, address, phone]
        );
        res.status(201).json({ 
            message: 'Delivery address created successfully', 
            address_id: result.insertId 
        });
    } catch (err) {
        console.error('Error in createDeliveryAddress:', err);
        res.status(500).json({error:'Server Error', details: err?.message});
    }
}

async function updateDeliveryAddress(req, res) {
    const { id } = req.params;
    const customer_id = req.user.id;
    const { address, phone } = req.body;

    try {
        // Check if address belongs to the customer
        const [existing] = await pool.query(
            'SELECT * FROM delivery_addresses WHERE address_id = ? AND customer_id = ?',
            [id, customer_id]
        );

        if (existing.length === 0) {
            return res.status(404).json({ error: 'Delivery address not found' });
        }

        let updateFields = [];
        let params = [];

        if (address) {
            updateFields.push('address = ?');
            params.push(address);
        }
        if (phone !== undefined) {
            updateFields.push('phone = ?');
            params.push(phone);
        }

        if (updateFields.length === 0) {
            return res.status(400).json({ error: 'No fields to update' });
        }

        params.push(id);

        await pool.query(
            `UPDATE delivery_addresses SET ${updateFields.join(', ')} WHERE address_id = ?`,
            params
        );

        res.json({ message: 'Delivery address updated successfully' });
    } catch (err) {
        console.error(err);
        res.status(500).json({error:'Server Error', details: err?.message});
    }
}

async function deleteDeliveryAddress(req, res) {
    const { id } = req.params;
    const customer_id = req.user.id;

    try {
        // Check if address belongs to the customer
        const [existing] = await pool.query(
            'SELECT * FROM delivery_addresses WHERE address_id = ? AND customer_id = ?',
            [id, customer_id]
        );

        if (existing.length === 0) {
            return res.status(404).json({ error: 'Delivery address not found' });
        }

        // Check if address is being used by any orders
        const [orders] = await pool.query(
            'SELECT COUNT(*) as count FROM orders WHERE address_id = ?',
            [id]
        );

        if (orders[0].count > 0) {
            return res.status(400).json({ 
                error: 'Cannot delete address that has been used in orders' 
            });
        }

        await pool.query('DELETE FROM delivery_addresses WHERE address_id = ?', [id]);

        res.json({ message: 'Delivery address deleted successfully' });
    } catch (err) {
        console.error(err);
        res.status(500).json({error:'Server Error', details: err?.message});
    }
}

module.exports = { 
    getDeliveryAddresses, 
    getDeliveryAddressById, 
    createDeliveryAddress, 
    updateDeliveryAddress, 
    deleteDeliveryAddress 
}; 
