// Notifications Controller 

const { pool } = require('../db/db');

async function getNotifications(req, res) {
    const user_id = req.user.id;
    const userRole = req.user.roleId;

    try {
        let query = 'SELECT * FROM notifications WHERE user_id = ?';
        let params = [user_id];

        // Different access based on user role
        if (userRole === 3 || userRole === 4 || userRole === 5) { // Vendor - also get notifications for their products
            query = `
                SELECT DISTINCT n.* 
                FROM notifications n
                LEFT JOIN orders o ON n.user_id = o.customer_id
                LEFT JOIN order_items oi ON o.order_id = oi.order_id
                LEFT JOIN products p ON oi.product_id = p.product_id
                WHERE n.user_id = ? OR p.vendor_id = ?
            `;
            params = [user_id, user_id];
        } else if (userRole === 1) { // Admin - can see all notifications
            query = 'SELECT * FROM notifications';
            params = [];
        }
        // Customer (role 3) - only their own notifications (default query)

        query += ' ORDER BY created_at DESC';

        const [rows] = await pool.query(query, params);
        res.json(rows);
    } catch (err) {
        console.error(err);
        res.status(500).json({error:'Server Error', details: err?.message});
    }
}

async function getNotificationById(req, res) {
    const { id } = req.params;
    const user_id = req.user.id;
    const userRole = req.user.roleId;

    try {
        let query = 'SELECT * FROM notifications WHERE notification_id = ?';
        let params = [id];

        const [rows] = await pool.query(query, params);
        
        if (rows.length === 0) {
            return res.status(404).json({error:'Notification not found'});
        }

        const notification = rows[0];

        // Check permissions based on user role
        if (userRole === 3) { // Customer - can only see their own notifications
            if (notification.user_id != user_id) {
                return res.status(403).json({ error: 'Access denied - You can only view your own notifications' });
            }
        } else if (userRole === 3 || userRole === 4 || userRole === 5) { // Vendor - can see notifications for their products or their own
            if (notification.user_id != user_id) {
                // Check if notification is related to their products
                const [vendorNotifications] = await pool.query(`
                    SELECT COUNT(*) as count 
                    FROM orders o
                    JOIN order_items oi ON o.order_id = oi.order_id
                    JOIN products p ON oi.product_id = p.product_id
                    WHERE o.customer_id = ? AND p.vendor_id = ?
                `, [notification.user_id, user_id]);
                
                if (vendorNotifications[0].count === 0) {
                    return res.status(403).json({ error: 'Access denied' });
                }
            }
        }
        // Admin (role 1) can see any notification - no additional check needed

        res.json(notification);
    } catch (err) {
        console.error(err);
        res.status(500).json({error:'Server Error', details: err?.message});
    }
}

async function createNotification(req, res) {
    const { user_id, message, type } = req.body;
    const adminRole = req.user.roleId;

    // Only admins can create notifications
    if (adminRole !== 1) {
        return res.status(403).json({ error: 'Access denied - Admin privileges required' });
    }

    if (!user_id || !message || !type) {
        return res.status(400).json({ error: 'User ID, message, and type are required' });
    }

    if (!['order', 'message', 'promotion'].includes(type)) {
        return res.status(400).json({ error: 'Type must be order, message, or promotion' });
    }

    try {
        // Check if user exists
        const [users] = await pool.query(
            'SELECT * FROM users WHERE user_id = ?',
            [user_id]
        );

        if (users.length === 0) {
            return res.status(404).json({ error: 'User not found' });
        }

        const [result] = await pool.query(
            'INSERT INTO notifications (user_id, message, type) VALUES (?, ?, ?)',
            [user_id, message, type]
        );

        res.status(201).json({ 
            message: 'Notification created successfully', 
            notification_id: result.insertId 
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({error:'Server Error', details: err?.message});
    }
}

async function markAsRead(req, res) {
    const { id } = req.params;
    const user_id = req.user.id;
    const userRole = req.user.roleId;

    try {
        // Check if notification exists and user has access
        const [notifications] = await pool.query(
            'SELECT * FROM notifications WHERE notification_id = ?',
            [id]
        );

        if (notifications.length === 0) {
            return res.status(404).json({ error: 'Notification not found' });
        }

        const notification = notifications[0];

        // Check permissions based on user role
        if (userRole === 3) { // Customer - can only mark their own notifications as read
            if (notification.user_id != user_id) {
                return res.status(403).json({ error: 'Access denied - You can only mark your own notifications as read' });
            }
        } else if (userRole === 3 || userRole === 4 || userRole === 5) { // Vendor - can mark notifications related to their products as read
            if (notification.user_id != user_id) {
                // Check if notification is related to their products
                const [vendorNotifications] = await pool.query(`
                    SELECT COUNT(*) as count 
                    FROM orders o
                    JOIN order_items oi ON o.order_id = oi.order_id
                    JOIN products p ON oi.product_id = p.product_id
                    WHERE o.customer_id = ? AND p.vendor_id = ?
                `, [notification.user_id, user_id]);
                
                if (vendorNotifications[0].count === 0) {
                    return res.status(403).json({ error: 'Access denied' });
                }
            }
        }
        // Admin (role 1) can mark any notification as read - no additional check needed

        const [result] = await pool.query(
            'UPDATE notifications SET is_read = 1 WHERE notification_id = ?',
            [id]
        );

        res.json({ message: 'Notification marked as read' });
    } catch (err) {
        console.error(err);
        res.status(500).json({error:'Server Error', details: err?.message});
    }
}

async function markAllAsRead(req, res) {
    const user_id = req.user.id;
    const userRole = req.user.roleId;

    try {
        let query = 'UPDATE notifications SET is_read = 1 WHERE user_id = ?';
        let params = [user_id];

        if (userRole === 1) { // Admin - can mark all notifications as read
            query = 'UPDATE notifications SET is_read = 1';
            params = [];
        } else if (userRole === 3 || userRole === 4 || userRole === 5) { // Vendor - mark their own and related notifications as read
            query = `
                UPDATE notifications n
                LEFT JOIN orders o ON n.user_id = o.customer_id
                LEFT JOIN order_items oi ON o.order_id = oi.order_id
                LEFT JOIN products p ON oi.product_id = p.product_id
                SET n.is_read = 1
                WHERE n.user_id = ? OR p.vendor_id = ?
            `;
            params = [user_id, user_id];
        }
        // Customer (role 3) - only their own notifications (default query)

        await pool.query(query, params);

        res.json({ message: 'All notifications marked as read' });
    } catch (err) {
        console.error(err);
        res.status(500).json({error:'Server Error', details: err?.message});
    }
}

async function deleteNotification(req, res) {
    const { id } = req.params;
    const user_id = req.user.id;
    const userRole = req.user.roleId;

    try {
        // Check if notification exists and user has access
        const [notifications] = await pool.query(
            'SELECT * FROM notifications WHERE notification_id = ?',
            [id]
        );

        if (notifications.length === 0) {
            return res.status(404).json({ error: 'Notification not found' });
        }

        const notification = notifications[0];

        // Check permissions based on user role
        if (userRole === 3) { // Customer - can only delete their own notifications
            if (notification.user_id != user_id) {
                return res.status(403).json({ error: 'Access denied - You can only delete your own notifications' });
            }
        } else if (userRole === 3 || userRole === 4 || userRole === 5) { // Vendor - can delete notifications related to their products
            if (notification.user_id != user_id) {
                // Check if notification is related to their products
                const [vendorNotifications] = await pool.query(`
                    SELECT COUNT(*) as count 
                    FROM orders o
                    JOIN order_items oi ON o.order_id = oi.order_id
                    JOIN products p ON oi.product_id = p.product_id
                    WHERE o.customer_id = ? AND p.vendor_id = ?
                `, [notification.user_id, user_id]);
                
                if (vendorNotifications[0].count === 0) {
                    return res.status(403).json({ error: 'Access denied' });
                }
            }
        }
        // Admin (role 1) can delete any notification - no additional check needed

        const [result] = await pool.query(
            'DELETE FROM notifications WHERE notification_id = ?',
            [id]
        );

        res.json({ message: 'Notification deleted successfully' });
    } catch (err) {
        console.error(err);
        res.status(500).json({error:'Server Error', details: err?.message});
    }
}

async function getUnreadCount(req, res) {
    const user_id = req.user.id;
    const userRole = req.user.roleId;

    try {
        let query = 'SELECT COUNT(*) as count FROM notifications WHERE user_id = ? AND is_read = 0';
        let params = [user_id];

        if (userRole === 1) { // Admin - count all unread notifications
            query = 'SELECT COUNT(*) as count FROM notifications WHERE is_read = 0';
            params = [];
        } else if (userRole === 3 || userRole === 4 || userRole === 5) { // Vendor - count their own and related unread notifications
            query = `
                SELECT COUNT(DISTINCT n.notification_id) as count 
                FROM notifications n
                LEFT JOIN orders o ON n.user_id = o.customer_id
                LEFT JOIN order_items oi ON o.order_id = oi.order_id
                LEFT JOIN products p ON oi.product_id = p.product_id
                WHERE (n.user_id = ? OR p.vendor_id = ?) AND n.is_read = 0
            `;
            params = [user_id, user_id];
        }
        // Customer (role 3) - only their own unread notifications (default query)

        const [rows] = await pool.query(query, params);
        res.json({ unread_count: rows[0].count });
    } catch (err) {
        console.error(err);
        res.status(500).json({error:'Server Error', details: err?.message});
    }
}

module.exports = { 
    getNotifications, 
    getNotificationById, 
    createNotification, 
    markAsRead, 
    markAllAsRead, 
    deleteNotification,
    getUnreadCount
}; 