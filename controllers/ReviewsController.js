// Reviews Controller 

const { pool } = require('../db/db');

async function getProductReviews(req, res) {
    const { product_id } = req.params;

    try {
        const [rows] = await pool.query(`
            SELECT r.*, u.name as customer_name
            FROM reviews r
            JOIN users u ON r.customer_id = u.user_id
            WHERE r.product_id = ?
            ORDER BY r.created_at DESC
        `, [product_id]);
        res.json(rows);
    } catch (err) {
        console.error(err);
        res.status(500).json({error:'Server Error', details: err?.message});
    }
}

async function getReviewById(req, res) {
    const { id } = req.params;
    const user_id = req.user.id;
    const userRole = req.user.roleId;

    try {
        const [rows] = await pool.query(`
            SELECT r.*, u.name as customer_name, p.name as product_name, p.vendor_id
            FROM reviews r
            JOIN users u ON r.customer_id = u.user_id
            JOIN products p ON r.product_id = p.product_id
            WHERE r.review_id = ?
        `, [id]);
        
        if (rows.length === 0) {
            return res.status(404).json({error:'Review not found'});
        }

        const review = rows[0];

        // Check permissions based on user role
        if (userRole === 3) { // Customer - can only see their own reviews
            if (review.customer_id != user_id) {
                return res.status(403).json({ error: 'Access denied - You can only view your own reviews' });
            }
        } else if (userRole === 3 || userRole === 4 || userRole === 5) { // Vendor - can only see reviews for their products
            if (review.vendor_id != user_id) {
                return res.status(403).json({ error: 'Access denied - You can only view reviews for your products' });
            }
        }
        // Admin (role 1) can see any review - no additional check needed

        res.json(review);
    } catch (err) {
        console.error(err);
        res.status(500).json({error:'Server Error', details: err?.message});
    }
}

async function createReview(req, res) {
    const customer_id = req.user.id;
    const userRole = req.user.roleId;
    const { product_id, rating, comment } = req.body;

    // Only customers can create reviews
    if (userRole !== 3) {
        return res.status(403).json({ error: 'Only customers can create reviews' });
    }

    if (!product_id || !rating) {
        return res.status(400).json({ error: 'Product ID and rating are required' });
    }

    if (rating < 1 || rating > 5) {
        return res.status(400).json({ error: 'Rating must be between 1 and 5' });
    }

    try {
        // Check if product exists
        const [products] = await pool.query(
            'SELECT * FROM products WHERE product_id = ? AND deleted = 0',
            [product_id]
        );

        if (products.length === 0) {
            return res.status(404).json({ error: 'Product not found' });
        }

        // Check if customer has already reviewed this product
        const [existing] = await pool.query(
            'SELECT * FROM reviews WHERE product_id = ? AND customer_id = ?',
            [product_id, customer_id]
        );

        if (existing.length > 0) {
            return res.status(400).json({ error: 'You have already reviewed this product' });
        }

        // Check if customer has purchased this product
        const [orders] = await pool.query(`
            SELECT COUNT(*) as count 
            FROM order_items oi
            JOIN orders o ON oi.order_id = o.order_id
            WHERE oi.product_id = ? AND o.customer_id = ? AND o.status = 'delivered'
        `, [product_id, customer_id]);

        if (orders[0].count === 0) {
            return res.status(400).json({ error: 'You can only review products you have purchased and received' });
        }

        const [result] = await pool.query(
            'INSERT INTO reviews (product_id, customer_id, rating, comment) VALUES (?, ?, ?, ?)',
            [product_id, customer_id, rating, comment]
        );

        res.status(201).json({ 
            message: 'Review created successfully', 
            review_id: result.insertId 
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({error:'Server Error', details: err?.message});
    }
}

async function updateReview(req, res) {
    const { id } = req.params;
    const customer_id = req.user.id;
    const userRole = req.user.roleId;
    const { rating, comment } = req.body;

    // Only customers can update their own reviews, but admins (role 1) can update any review
    if (userRole !== 3 && userRole !== 1) {
        return res.status(403).json({ error: 'Only customers or admins can update reviews' });
    }

    if (rating && (rating < 1 || rating > 5)) {
        return res.status(400).json({ error: 'Rating must be between 1 and 5' });
    }

    try {
        let existing;
        if (userRole === 3) {
            // Customers can only update their own reviews
            [existing] = await pool.query(
                'SELECT * FROM reviews WHERE review_id = ? AND customer_id = ?',
                [id, customer_id]
            );
        } else if (userRole === 1) {
            // Admins can update any review
            [existing] = await pool.query(
                'SELECT * FROM reviews WHERE review_id = ?',
                [id]
            );
        }

        if (!existing || existing.length === 0) {
            return res.status(404).json({ error: 'Review not found or access denied' });
        }

        let updateFields = [];
        let params = [];

        if (rating !== undefined) {
            updateFields.push('rating = ?');
            params.push(rating);
        }
        if (comment !== undefined) {
            updateFields.push('comment = ?');
            params.push(comment);
        }

        if (updateFields.length === 0) {
            return res.status(400).json({ error: 'No fields to update' });
        }

        params.push(id);

        await pool.query(
            `UPDATE reviews SET ${updateFields.join(', ')} WHERE review_id = ?`,
            params
        );

        res.json({ message: 'Review updated successfully' });
    } catch (err) {
        console.error(err);
        res.status(500).json({error:'Server Error', details: err?.message});
    }
}

async function deleteReview(req, res) {
    const { id } = req.params;
    const user_id = req.user.id;
    const userRole = req.user.roleId;

    try {
        // Get review details to check permissions
        const [reviews] = await pool.query(`
            SELECT r.*, p.vendor_id 
            FROM reviews r
            JOIN products p ON r.product_id = p.product_id
            WHERE r.review_id = ?
        `, [id]);

        if (reviews.length === 0) {
            return res.status(404).json({ error: 'Review not found' });
        }

        const review = reviews[0];

        // Check permissions based on user role
        if (userRole === 3) { // Customer - can only delete their own reviews
            if (review.customer_id != user_id) {
                return res.status(403).json({ error: 'Access denied - You can only delete your own reviews' });
            }
        } else if (userRole === 3 || userRole === 4 || userRole === 5) { // Vendor - can only delete reviews for their products
            if (review.vendor_id != user_id) {
                return res.status(403).json({ error: 'Access denied - You can only delete reviews for your products' });
            }
        }
        // Admin (role 1) can delete any review - no additional check needed

        await pool.query('DELETE FROM reviews WHERE review_id = ?', [id]);

        res.json({ message: 'Review deleted successfully' });
    } catch (err) {
        console.error(err);
        res.status(500).json({error:'Server Error', details: err?.message});
    }
}

async function getAllUserReviews(req, res) {
    try {
        const page = parseInt(req.query.page) || 1;
        let limit = req.query.limit !== undefined ? parseInt(req.query.limit) : 20;
        let offset = (page - 1) * limit;
        const search = req.query.search || '';
        if (limit === 0) offset = 0;
        let whereClause = '';
        let params = [];
        if (search) {
            whereClause = `WHERE (r.comment LIKE ? OR u.name LIKE ? OR r.product_id LIKE ?)`;
            params.push(`%${search}%`, `%${search}%`, `%${search}%`);
        }
        // Get total count
        const [countRows] = await pool.query(`
            SELECT COUNT(*) as total
            FROM reviews r
            JOIN users u ON r.customer_id = u.user_id
            ${whereClause}
        `, params);
        const total = countRows[0]?.total || 0;
        // Get data (all if limit=0, paginated otherwise)
        const dataQuery = `
            SELECT r.*, u.name as customer_name
            FROM reviews r
            JOIN users u ON r.customer_id = u.user_id
            ${whereClause}
            ORDER BY r.created_at DESC
            ${limit > 0 ? 'LIMIT ? OFFSET ?' : ''}
        `;
        const dataParams = limit > 0 ? [...params, limit, offset] : params;
        const [rows] = await pool.query(dataQuery, dataParams);
        res.json({ data: rows, total, page, pageSize: limit });
    } catch (err) {
        console.error(err);
        res.status(500).json({error:'Server Error', details: err?.message});
    }
}

module.exports = { 
    getProductReviews, 
    getReviewById, 
    createReview, 
    updateReview, 
    deleteReview,
    getAllUserReviews
}; 