// Coupons Controller 

const { pool } = require('../db/db');

async function getAllCoupons(req, res) {
    try {
        const [rows] = await pool.query(`
            SELECT *, 
                   CASE 
                       WHEN expire_at IS NULL OR expire_at > NOW() THEN 'active'
                       ELSE 'expired'
                   END as status
            FROM coupons 
            ORDER BY expire_at DESC
        `);
        res.json(rows);
    } catch (err) {
        console.error(err);
        res.status(500).json({error:'Server Error', details: err?.message});
    }
}

async function getCouponById(req, res) {
    const { id } = req.params;
    try {
        const [rows] = await pool.query('SELECT * FROM coupons WHERE coupon_id = ?', [id]);
        if (rows.length) res.json(rows[0]);
        else res.status(404).json({error:'Coupon not found'});
    } catch (err) {
        console.error(err);
        res.status(500).json({error:'Server Error', details: err?.message});
    }
}

async function getCouponByCode(req, res) {
    const { code } = req.params;
    const cart_total = parseFloat(req.query.cart_total);
    try {
        const [rows] = await pool.query(
            'SELECT * FROM coupons WHERE code = ? AND is_active = 1',
            [code]
        );
        if (!rows.length) {
            return res.status(404).json({valid: false, reason: 'not_found', error:'Coupon not found'});
        }
        const coupon = rows[0];
        // Check expiration
        if (coupon.expire_at && new Date(coupon.expire_at) < new Date()) {
            return res.status(400).json({valid: false, reason: 'expired', error:'Coupon expired'});
        }
        // Check max uses
        if (coupon.max_uses && coupon.used_count >= coupon.max_uses) {
            return res.status(400).json({valid: false, reason: 'max_uses', error:'Coupon usage limit reached'});
        }
        // Check min order amount
        if (coupon.min_order_amount && !isNaN(cart_total) && cart_total < parseFloat(coupon.min_order_amount)) {
            return res.status(400).json({valid: false, reason: 'min_order', error: 'Cart total does not meet minimum order amount for this coupon'});
        }
        // Increment used_count
        await pool.query('UPDATE coupons SET used_count = used_count + 1 WHERE coupon_id = ?', [coupon.coupon_id]);
        res.json({
            valid: true,
            code: coupon.code,
            discount_percentage: coupon.discount_percentage,
            discount_amount: coupon.discount_amount,
            min_order_amount: coupon.min_order_amount,
            max_uses: coupon.max_uses,
            used_count: coupon.used_count + 1,
            expire_at: coupon.expire_at,
            is_active: coupon.is_active
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({error:'Server Error', details: err?.message});
    }
}

async function createCoupon(req, res) {
    const { code, discount_percentage, expire_at } = req.body;

    if (!code || !discount_percentage) {
        return res.status(400).json({ error: 'Code and discount_percentage are required' });
    }

    if (discount_percentage < 0 || discount_percentage > 100) {
        return res.status(400).json({ error: 'Discount percentage must be between 0 and 100' });
    }

    try {
        const [result] = await pool.query(
            'INSERT INTO coupons (code, discount_percentage, expire_at) VALUES (?, ?, ?)',
            [code, discount_percentage, expire_at]
        );
        res.status(201).json({ 
            message: 'Coupon created successfully', 
            coupon_id: result.insertId 
        });
    } catch (err) {
        console.error(err);
        if (err.code === 'ER_DUP_ENTRY') {
            res.status(400).json({error:'Coupon code already exists'});
        } else {
            res.status(500).json({error:'Server Error', details: err?.message});
        }
    }
}

async function updateCoupon(req, res) {
    const { id } = req.params;
    const { code, discount_percentage, expire_at, is_active, min_order_amount, max_uses } = req.body;

    if (discount_percentage && (discount_percentage < 0 || discount_percentage > 100)) {
        return res.status(400).json({ error: 'Discount percentage must be between 0 and 100' });
    }

    try {
        let updateFields = [];
        let params = [];

        if (code) {
            updateFields.push('code = ?');
            params.push(code);
        }
        if (discount_percentage !== undefined) {
            updateFields.push('discount_percentage = ?');
            params.push(discount_percentage);
        }
        if (expire_at !== undefined) {
            updateFields.push('expire_at = ?');
            params.push(expire_at);
        }
        if (is_active !== undefined) {
            updateFields.push('is_active = ?');
            params.push(is_active === true || is_active === 1 ? 1 : 0);
        }
        if (min_order_amount !== undefined) {
            updateFields.push('min_order_amount = ?');
            params.push(min_order_amount);
        }
        if (max_uses !== undefined) {
            updateFields.push('max_uses = ?');
            params.push(max_uses);
        }

        if (updateFields.length === 0) {
            return res.status(400).json({ error: 'No fields to update' });
        }

        params.push(id);

        const [result] = await pool.query(
            `UPDATE coupons SET ${updateFields.join(', ')} WHERE coupon_id = ?`,
            params
        );

        if (result.affectedRows === 0) {
            return res.status(404).json({ error: 'Coupon not found' });
        }

        res.json({ message: 'Coupon updated successfully' });
    } catch (err) {
        console.error(err);
        if (err.code === 'ER_DUP_ENTRY') {
            res.status(400).json({error:'Coupon code already exists'});
        } else {
            res.status(500).json({error:'Server Error', details: err?.message});
        }
    }
}

async function deleteCoupon(req, res) {
    const { id } = req.params;

    try {
        // Check if coupon is being used by any orders
        const [orders] = await pool.query(
            'SELECT COUNT(*) as count FROM orders WHERE coupon_id = ?',
            [id]
        );

        if (orders[0].count > 0) {
            return res.status(400).json({ 
                error: 'Cannot delete coupon that has been used in orders' 
            });
        }

        const [result] = await pool.query('DELETE FROM coupons WHERE coupon_id = ?', [id]);
        
        if (result.affectedRows === 0) {
            return res.status(404).json({ error: 'Coupon not found' });
        }

        res.json({ message: 'Coupon deleted successfully' });
    } catch (err) {
        console.error(err);
        res.status(500).json({error:'Server Error', details: err?.message});
    }
}

module.exports = { 
    getAllCoupons, 
    getCouponById, 
    getCouponByCode,
    createCoupon, 
    updateCoupon, 
    deleteCoupon 
}; 