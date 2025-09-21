const DeliveryPersonnel = require('../models/DeliveryPersonnel');
const Order = require('../models/Order');
const { pool } = require('../db/db');
const User = require('../models/User');
const DeliveryZone = require('../models/DeliveryZone');

class DeliveryController {
    // Get all available delivery personnel
    static async getAvailableDeliveryPersonnel(req, res) {
        try {
            const [personnel] = await pool.execute(`
                SELECT dp.*, u.name, u.phone, dz.name_en as zone_name
                FROM delivery_personnel dp
                JOIN users u ON dp.user_id = u.user_id
                LEFT JOIN delivery_zones dz ON dp.zone_id = dz.zone_id
                WHERE dp.is_available = 1
                ORDER BY dp.rating DESC, dp.total_deliveries ASC
            `);



            res.json({
                success: true,
                data: personnel,
                message: 'Available delivery personnel retrieved successfully'
            });
        } catch (error) {
            console.error('Error getting available delivery personnel:', error);
            res.status(500).json({
                success: false,
                error: 'Failed to get available delivery personnel',
                details: error.message
            });
        }
    }

    // Assign order to delivery personnel
    static async assignOrderToDelivery(req, res) {
        const { order_id, delivery_id, estimated_pickup_time, notes } = req.body;
        const assigned_by = req.user.id;



        let connection;
        try {
            connection = await pool.getConnection();

            // Validate required fields
            if (!order_id || !delivery_id) {
                if (connection) connection.release();
                return res.status(400).json({
                    success: false,
                    error: 'Order ID and Delivery ID are required'
                });
            }

            // First, check if delivery personnel exists
            const [deliveryPersonnelCheck] = await connection.execute(
                'SELECT delivery_id, user_id, is_available FROM delivery_personnel WHERE delivery_id = ?',
                [delivery_id]
            );

            if (deliveryPersonnelCheck.length === 0) {
                if (connection) connection.release();
                return res.status(404).json({
                    success: false,
                    error: `Delivery personnel with ID ${delivery_id} not found`
                });
            }

            // Check if delivery personnel is available
            if (!deliveryPersonnelCheck[0].is_available) {
                if (connection) connection.release();
                return res.status(400).json({
                    success: false,
                    error: 'Delivery personnel is not available for assignments'
                });
            }

            // Check if order exists and is assignable
            const [orderResult] = await connection.execute(
                'SELECT * FROM orders WHERE order_id = ? AND status IN ("processing", "pending")',
                [order_id]
            );
            if (orderResult.length === 0) {
                if (connection) connection.release();
                return res.status(404).json({
                    success: false,
                    error: 'Order not found or not available for assignment'
                });
            }

            // Check if customer exists (for debugging purposes)
            const [customerCheck] = await connection.execute(
                'SELECT user_id, name, email FROM users WHERE user_id = ?',
                [orderResult[0].customer_id]
            );

            // Check if order is already assigned
            const [existingAssignment] = await connection.execute(
                'SELECT * FROM delivery_assignments WHERE order_id = ?',
                [order_id]
            );
            if (existingAssignment.length > 0) {
                if (connection) connection.release();
                return res.status(400).json({
                    success: false,
                    error: 'Order is already assigned to delivery personnel'
                });
            }

            // Check if assigned_by user exists
            const [userCheck] = await connection.execute(
                'SELECT user_id FROM users WHERE user_id = ?',
                [assigned_by]
            );
            if (userCheck.length === 0) {
                if (connection) connection.release();
                return res.status(400).json({
                    success: false,
                    error: 'Invalid assigned_by user ID'
                });
            }

            await connection.query('START TRANSACTION');
            try {
                // Create delivery assignment
                await connection.execute(
                    'INSERT INTO delivery_assignments (order_id, delivery_id, assigned_by, notes) VALUES (?, ?, ?, ?)',
                    [order_id, delivery_id, assigned_by, notes || null]
                );

                // Create delivery tracking entry first
                await connection.execute(
                    'INSERT INTO delivery_tracking (order_id, delivery_id, status, notes) VALUES (?, ?, "assigned", ?)',
                    [order_id, delivery_id, notes || `Order assigned to delivery personnel. Estimated pickup: ${estimated_pickup_time || 'ASAP'}`]
                );

                // Update order status and delivery info (this will trigger the notification)
                const estimatedDeliveryTime = estimated_pickup_time ?
                    new Date(estimated_pickup_time).getTime() + (24 * 60 * 60 * 1000) : // 24 hours from pickup
                    new Date().getTime() + (24 * 60 * 60 * 1000);

                // Update order status and delivery info
                await connection.execute(
                    'UPDATE orders SET status = "assigned", delivery_id = ?, estimated_delivery_time = ? WHERE order_id = ?',
                    [delivery_id, new Date(estimatedDeliveryTime), order_id]
                );

                // Note: The trigger will handle notification creation automatically
                // and will skip if customer doesn't exist

                await connection.query('COMMIT');

                // Get assignment details for response
                const [assignmentResult] = await connection.execute(`
                    SELECT da.*, u.name as assigned_by_name, dp.vehicle_type, dp.vehicle_number,
                           u_dp.name as delivery_person_name, u_dp.phone as delivery_person_phone
                    FROM delivery_assignments da
                    JOIN users u ON da.assigned_by = u.user_id
                    JOIN delivery_personnel dp ON da.delivery_id = dp.delivery_id
                    JOIN users u_dp ON dp.user_id = u_dp.user_id
                    WHERE da.order_id = ?
                `, [order_id]);

                res.json({
                    success: true,
                    data: assignmentResult[0],
                    message: 'Order assigned to delivery personnel successfully'
                });
            } catch (error) {
                await connection.query('ROLLBACK');
                console.error('Transaction error:', error);
                throw error;
            }
        } catch (error) {
            console.error('Error assigning order to delivery:', error);

            // Provide more specific error messages
            let errorMessage = 'Failed to assign order to delivery personnel';
            if (error.code === 'ER_NO_REFERENCED_ROW_2') {
                errorMessage = 'Invalid delivery personnel or user reference';
            } else if (error.code === 'ER_DUP_ENTRY') {
                errorMessage = 'Order is already assigned to delivery personnel';
            }

            res.status(500).json({
                success: false,
                error: errorMessage,
                details: error.message
            });
        } finally {
            if (connection) connection.release();
        }
    }

    // Update delivery status (pickup, in transit, delivered)
    static async updateDeliveryStatus(req, res) {
        try {
            const { order_id, status, notes, delivery_confirmation_notes } = req.body;
            const delivery_id = req.user.delivery_id; // From delivery personnel token
            const delivery_confirmation_image = req.file ? `${req.protocol}://${req.get('host')}/uploads/delivery-confirmations/${req.file.filename}` : null;

            // Validate required fields
            if (!order_id || !status) {
                return res.status(400).json({
                    success: false,
                    error: 'Order ID and status are required'
                });
            }

            if (!delivery_id) {
                return res.status(400).json({
                    success: false,
                    error: 'Delivery ID not found. Please contact administrator.'
                });
            }

            // Validate status
            const validStatuses = ['picked_up', 'in_transit', 'delivered', 'failed', 'returned'];
            if (!validStatuses.includes(status)) {
                return res.status(400).json({
                    success: false,
                    error: `Invalid status. Must be one of: ${validStatuses.join(', ')}`
                });
            }

            // For delivered status, require confirmation image
            if (status === 'delivered' && !delivery_confirmation_image) {
                return res.status(400).json({
                    success: false,
                    error: 'Delivery confirmation image is required when marking as delivered'
                });
            }

            // Check if delivery personnel is assigned to this order (check both delivery_assignments and orders tables)
            const [assignmentResult] = await pool.execute(
                'SELECT * FROM delivery_assignments WHERE order_id = ? AND delivery_id = ?',
                [order_id, delivery_id]
            );

            const [orderAssignmentResult] = await pool.execute(
                'SELECT order_id FROM orders WHERE order_id = ? AND delivery_id = ?',
                [order_id, delivery_id]
            );

            if (assignmentResult.length === 0 && orderAssignmentResult.length === 0) {
                return res.status(403).json({
                    success: false,
                    error: 'You are not assigned to this order'
                });
            }

            // Begin transaction
            await pool.query('START TRANSACTION');

            try {
                // Update order status and delivery confirmation details
                let updateQuery = 'UPDATE orders SET status = ?';
                let updateParams = [status];

                if (status === 'delivered') {
                    updateQuery += ', actual_delivery_time = NOW(), delivery_confirmation_image = ?, delivery_confirmed_at = NOW()';
                    updateParams.push(delivery_confirmation_image);

                    if (delivery_confirmation_notes) {
                        updateQuery += ', delivery_confirmation_notes = ?';
                        updateParams.push(delivery_confirmation_notes);
                    }
                } else if (status === 'picked_up') {
                    updateQuery += ', picked_up_time = NOW()';
                } else if (status === 'in_transit') {
                    updateQuery += ', in_transit_time = NOW()';
                }

                updateQuery += ' WHERE order_id = ?';
                updateParams.push(order_id);

                await pool.execute(updateQuery, updateParams);

                // Create delivery tracking entry
                let trackingNotes = notes || `Order status updated to ${status}`;
                if (status === 'delivered' && delivery_confirmation_notes) {
                    trackingNotes += `. Notes: ${delivery_confirmation_notes}`;
                }

                await pool.execute(
                    'INSERT INTO delivery_tracking (order_id, delivery_id, status, notes) VALUES (?, ?, ?, ?)',
                    [order_id, delivery_id, status, trackingNotes]
                );

                await pool.query('COMMIT');

                res.json({
                    success: true,
                    message: `Order status updated to ${status} successfully`,
                    data: {
                        order_id,
                        status,
                        delivery_confirmation_image: status === 'delivered' ? delivery_confirmation_image : null,
                        delivery_confirmed_at: status === 'delivered' ? new Date() : null
                    }
                });

            } catch (error) {
                await pool.query('ROLLBACK');
                throw error;
            }

        } catch (error) {
            console.error('Error updating delivery status:', error);
            res.status(500).json({
                success: false,
                error: 'Failed to update delivery status',
                details: error.message
            });
        }
    }

    // Get delivery tracking for an order
    static async getDeliveryTracking(req, res) {
        try {
            let { order_id } = req.params;
                        if (order_id === undefined || isNaN(Number(order_id))) {
                return res.status(400).json({
                    success: false,
                    error: 'Invalid or missing order_id parameter.'
                });
            }
            order_id = Number(order_id);
            const user_id = req.user.id;
            const userRole = req.user.roleId;

            // Check permissions
            if (userRole === 3) { // Customer
                const [orderResult] = await pool.execute(
                    'SELECT customer_id FROM orders WHERE order_id = ?',
                    [order_id]
                );
                if (orderResult.length === 0 || orderResult[0].customer_id !== user_id) {
                    return res.status(403).json({
                        success: false,
                        error: 'Access denied'
                    });
                }
            }

            // Get order details with customer and delivery information
            const [orderResult] = await pool.execute(`
                SELECT 
                    o.*,
                    u.name as customer_name,
                    u.email as customer_email,
                    u.phone as customer_phone,
                    da.address as delivery_address,
                    da.phone as delivery_phone,
                    dz.name_en as delivery_zone_name,
                    dz.delivery_fee,
                    dp.delivery_id,
                    dp.vehicle_type,
                    dp.vehicle_number,
                    u_dp.name as delivery_person_name,
                    u_dp.phone as delivery_person_phone
                FROM orders o
                JOIN users u ON o.customer_id = u.user_id
                LEFT JOIN delivery_addresses da ON o.address_id = da.address_id
                LEFT JOIN delivery_zones dz ON o.delivery_zone_id = dz.zone_id
                LEFT JOIN delivery_personnel dp ON o.delivery_id = dp.delivery_id
                LEFT JOIN users u_dp ON dp.user_id = u_dp.user_id
                WHERE o.order_id = ?
            `, [order_id]);

            if (orderResult.length === 0) {
                return res.status(404).json({
                    success: false,
                    error: 'Order not found'
                });
            }

            const order = orderResult[0];

            // Get order items with product details
            const [orderItemsResult] = await pool.execute(`
                SELECT 
                    oi.*,
                    p.name as product_name,
                    p.description as product_description,
                    p.image_url as product_image,
                    p.price as product_price,
                    c.name_en as category_name
                FROM order_items oi
                JOIN products p ON oi.product_id = p.product_id
                LEFT JOIN categories c ON p.category_id = c.category_id
                WHERE oi.order_id = ?
                ORDER BY oi.id ASC
            `, [order_id]);

            // Get delivery tracking history
            const [trackingResult] = await pool.execute(`
                SELECT 
                    dt.*,
                    u.name as delivery_person_name,
                    u.phone as delivery_person_phone,
                    dp.vehicle_type,
                    dp.vehicle_number
                FROM delivery_tracking dt
                LEFT JOIN delivery_personnel dp ON dt.delivery_id = dp.delivery_id
                LEFT JOIN users u ON dp.user_id = u.user_id
                WHERE dt.order_id = ?
                ORDER BY dt.timestamp ASC
            `, [order_id]);

            // Get payment information
            const [paymentResult] = await pool.execute(`
                SELECT 
                    p.*,
                    pc.payment_received,
                    pc.customer_signature,
                    pc.delivery_photo,
                    pc.notes as payment_notes
                FROM payments p
                LEFT JOIN payment_confirmations pc ON p.order_id = pc.order_id
                WHERE p.order_id = ?
            `, [order_id]);

            // Calculate order summary
            const totalItems = orderItemsResult.reduce((sum, item) => sum + (parseInt(item.qty) || 0), 0);
            const subtotal = orderItemsResult.reduce((sum, item) => sum + (parseFloat(item.total_price || 0)), 0);
            const totalWithDelivery = subtotal + parseFloat(order.delivery_fee || 0);

            res.json({
                success: true,
                data: {
                    order: {
                        order_id: order.order_id,
                        status: order.status,
                        total: order.total,
                        subtotal: subtotal,
                        delivery_fee: order.delivery_fee,
                        discount_amount: order.discount_amount,
                        payment_method: order.payment_method,
                        placed_at: order.placed_at,
                        estimated_delivery_time: order.estimated_delivery_time,
                        actual_delivery_time: order.actual_delivery_time,
                        delivery_confirmation_image: order.delivery_confirmation_image,
                        delivery_confirmed_at: order.delivery_confirmed_at,
                        delivery_confirmation_notes: order.delivery_confirmation_notes
                    },
                    customer: {
                        name: order.customer_name,
                        email: order.customer_email,
                        phone: order.customer_phone
                    },
                    delivery: {
                        address: order.delivery_address,
                        phone: order.delivery_phone,
                        zone: order.delivery_zone_name,
                        delivery_fee: order.delivery_fee
                    },
                    delivery_personnel: order.delivery_id ? {
                        delivery_id: order.delivery_id,
                        name: order.delivery_person_name,
                        phone: order.delivery_person_phone,
                        vehicle_type: order.vehicle_type,
                        vehicle_number: order.vehicle_number
                    } : null,
                    items: orderItemsResult.map(item => ({
                        id: item.id,
                        product_id: item.product_id,
                        product_name: item.product_name,
                        product_description: item.product_description,
                        product_image: item.product_image,
                        product_price: item.product_price,
                        category_name: item.category_name,
                        qty: item.qty,
                        price: item.price,
                        total_price: item.total_price
                    })),
                    tracking: trackingResult.map(track => ({
                        tracking_id: track.tracking_id,
                        status: track.status,
                        notes: track.notes,
                        timestamp: track.timestamp,
                        delivery_person_name: track.delivery_person_name,
                        delivery_person_phone: track.delivery_person_phone,
                        vehicle_type: track.vehicle_type,
                        vehicle_number: track.vehicle_number
                    })),
                    payment: paymentResult.length > 0 ? {
                        payment_id: paymentResult[0].payment_id,
                        amount: paymentResult[0].amount,
                        method: paymentResult[0].method,
                        status: paymentResult[0].status,
                        transaction_id: paymentResult[0].transaction_id,
                        processed_at: paymentResult[0].processed_at,
                        payment_received: paymentResult[0].payment_received,
                        customer_signature: paymentResult[0].customer_signature,
                        delivery_photo: paymentResult[0].delivery_photo,
                        payment_notes: paymentResult[0].payment_notes
                    } : null,
                    summary: {
                        total_items: totalItems,
                        subtotal: subtotal,
                        total_with_delivery: totalWithDelivery,
                        tracking_count: trackingResult.length,
                        last_update: trackingResult.length > 0 ? trackingResult[trackingResult.length - 1].timestamp : null
                    }
                },
                message: 'Delivery tracking retrieved successfully'
            });

        } catch (error) {
            console.error('Error getting delivery tracking:', error);
            res.status(500).json({
                success: false,
                error: 'Failed to get delivery tracking',
                details: error.message
            });
        }
    }

    // Get orders assigned to delivery personnel
    static async getMyDeliveries(req, res) {
        try {
            const delivery_id = req.user.delivery_id;
            const { status } = req.query;

            if (!delivery_id) {
                return res.status(400).json({
                    success: false,
                    error: 'Delivery ID not found. Please contact administrator.'
                });
            }

            let statusFilter = "";
            let params = [delivery_id];

            // Status filters
            if (status) {
                if (status === 'active') {
                    statusFilter = "AND o.status IN ('assigned', 'picked_up', 'in_transit')";
                } else if (status === 'completed') {
                    statusFilter = "AND o.status = 'delivered'";
                } else if (status === 'today') {
                    statusFilter = "AND o.status = 'delivered' AND DATE(o.actual_delivery_time) = CURDATE()";
                } else if (status === 'today_assigned') {
                    statusFilter = "AND o.status = 'assigned' AND DATE(o.placed_at) = CURDATE()";
                } else if (status === 'today_revenue') {
                    statusFilter = "AND o.status = 'delivered' AND DATE(o.actual_delivery_time) = CURDATE()";
                } else if (status === 'this_month_revenue') {
                    statusFilter = "AND o.status = 'delivered' AND DATE(o.actual_delivery_time) >= DATE_SUB(CURDATE(), INTERVAL DAY(CURDATE())-1 DAY)";
                } else {
                    statusFilter = "AND o.status = ?";
                    params.push(status);
                }
            } else {
                statusFilter = "AND o.status IN ('pending', 'processing', 'assigned', 'picked_up', 'in_transit', 'delivered', 'failed')";
            }

            // Orders query
            const [ordersResult] = await pool.execute(`
            SELECT 
                o.order_id,
                o.customer_id,
                o.status,
                o.placed_at,
                o.estimated_delivery_time,
                o.actual_delivery_time,
                o.delivery_notes,
                o.total,
                u.name AS customer_name,
                da.address AS delivery_address,
                da.phone AS customer_phone,
                dz.name_en AS delivery_zone_name,
                da.phone AS delivery_phone,
                pay.method AS payment_method
            FROM orders o
            JOIN users u ON o.customer_id = u.user_id
            JOIN delivery_addresses da ON o.address_id = da.address_id
            LEFT JOIN delivery_zones dz ON o.delivery_zone_id = dz.zone_id
            LEFT JOIN payments pay ON o.order_id = pay.order_id
            WHERE o.delivery_id = ? ${statusFilter}
            ORDER BY o.estimated_delivery_time ASC
        `, params);

            if (!ordersResult.length) {
                return res.json({
                    success: true,
                    data: [],
                    message: 'No deliveries found'
                });
            }

            // Get all order IDs
            const orderIds = ordersResult.map(o => o.order_id);

            // Items query including vendor address & phone
            const [itemsResult] = await pool.execute(`
            SELECT 
                oi.order_id,
                oi.product_id,
                p.name AS product_name,
                oi.qty AS quantity,
                oi.price,
                p.vendor_id,
                vu.address AS vendor_address,
                vu.phone AS vendor_phone
            FROM order_items oi
            JOIN products p ON oi.product_id = p.product_id
            JOIN users vu ON p.vendor_id = vu.user_id
            WHERE oi.order_id IN (${orderIds.map(() => '?').join(',')})
        `, orderIds);

            // Attach items & vendor addresses
            for (const order of ordersResult) {
                const orderItems = itemsResult.filter(i => i.order_id === order.order_id);

                order.items = orderItems.map(i => ({
                    product_name: i.product_name,
                    quantity: i.quantity,
                    price: i.price,
                    vendor_address: i.vendor_address,
                    vendor_phone: i.vendor_phone
                }));

                // Unique vendor addresses for this order
                const uniqueAddresses = [...new Map(orderItems.map(i => [i.vendor_address, i.vendor_phone])).entries()]
                    .map(([address, phone]) => ({ address, phone }));

                order.vendor_addresses = uniqueAddresses.length === 1
                    ? uniqueAddresses[0]
                    : uniqueAddresses;
            }

            res.json({
                success: true,
                data: ordersResult,
                message: 'My deliveries retrieved successfully'
            });

        } catch (error) {
            console.error('Error getting my deliveries:', error);
            res.status(500).json({
                success: false,
                error: 'Failed to get my deliveries',
                details: error.message
            });
        }
    }


    // Get unassigned orders (for admin and order manager)
    static async getUnassignedOrders(req, res) {
        try {
            const userRole = req.user.roleId;
            if (userRole !== 1 && userRole !== 10&& userRole !== 12) { // Admin and Order Manager
                return res.status(403).json({
                    success: false,
                    error: 'Access denied. Admin or Order Manager only.'
                });
            }

            const [ordersResult] = await pool.execute(`
                SELECT o.*, u.name as customer_name, da.address as delivery_address,
                       da.phone as customer_phone, dz.name_en as delivery_zone_name
                FROM orders o
                JOIN users u ON o.customer_id = u.user_id
                JOIN delivery_addresses da ON o.address_id = da.address_id
                LEFT JOIN delivery_zones dz ON o.delivery_zone_id = dz.zone_id
                WHERE o.status IN ('processing', 'pending') AND o.delivery_id IS NULL
                ORDER BY o.placed_at ASC
            `);

            res.json({
                success: true,
                data: ordersResult,
                message: 'Unassigned orders retrieved successfully'
            });

        } catch (error) {
            console.error('Error getting unassigned orders:', error);
            res.status(500).json({
                success: false,
                error: 'Failed to get unassigned orders',
                details: error.message
            });
        }
    }

    // Update delivery personnel availability
    static async updateAvailability(req, res) {
        try {
            const { is_available } = req.body;
            const delivery_id = req.user.delivery_id;

            if (!delivery_id) {
                return res.status(400).json({
                    success: false,
                    error: 'Delivery ID not found. Please contact administrator.'
                });
            }

            await pool.execute(
                'UPDATE delivery_personnel SET is_available = ? WHERE delivery_id = ?',
                [is_available ? 1 : 0, delivery_id]
            );

            res.json({
                success: true,
                message: `Availability updated to ${is_available ? 'available' : 'unavailable'}`
            });

        } catch (error) {
            console.error('Error updating availability:', error);
            res.status(500).json({
                success: false,
                error: 'Failed to update availability',
                details: error.message
            });
        }
    }

    // Get delivery statistics
    static async getDeliveryStats(req, res) {
        try {
            const delivery_id = req.user.delivery_id;

            if (!delivery_id) {
                return res.status(400).json({
                    success: false,
                    error: 'Delivery ID not found. Please contact administrator.'
                });
            }

            // Get order statistics
            const [statsResult] = await pool.execute(`
                SELECT 
                    COUNT(*) as total_orders,
                    SUM(CASE WHEN status = 'delivered' THEN 1 ELSE 0 END) as completed_orders,
                    SUM(CASE WHEN status IN ('assigned', 'picked_up', 'in_transit') THEN 1 ELSE 0 END) as active_orders,
                    SUM(CASE WHEN status = 'delivered' AND DATE(actual_delivery_time) = CURDATE() THEN 1 ELSE 0 END) as today_deliveries,
                    SUM(CASE WHEN status = 'assigned' AND DATE(placed_at) = CURDATE() THEN 1 ELSE 0 END) as today_assigned_orders,
                    SUM(CASE WHEN status = 'delivered' THEN total ELSE 0 END) as total_revenue,
                    SUM(CASE WHEN status = 'delivered' AND DATE(actual_delivery_time) = CURDATE() THEN total ELSE 0 END) as today_revenue,
                    SUM(CASE WHEN status = 'delivered' AND DATE(actual_delivery_time) >= DATE_SUB(CURDATE(), INTERVAL DAY(CURDATE())-1 DAY) THEN total ELSE 0 END) as this_month_revenue,
                    AVG(CASE WHEN status = 'delivered' THEN TIMESTAMPDIFF(MINUTE, placed_at, actual_delivery_time) END) as avg_delivery_time
                FROM orders 
                WHERE delivery_id = ?
            `, [delivery_id]);

            // Get earnings statistics
            const [earningsResult] = await pool.execute(`
                SELECT 
                    total_earnings,
                    this_month_earnings,
                    this_week_earnings,
                    today_earnings
                FROM delivery_personnel 
                WHERE delivery_id = ?
            `, [delivery_id]);

            // Get recent earnings records
            const [recentEarningsResult] = await pool.execute(`
                SELECT 
                    de.earnings_id,
                    de.order_id,
                    de.delivery_fee,
                    de.earnings_amount,
                    de.status,
                    de.earned_at,
                    dz.name_en as zone_name,
                    o.total as order_total
                FROM delivery_earnings de
                JOIN delivery_zones dz ON de.zone_id = dz.zone_id
                JOIN orders o ON de.order_id = o.order_id
                WHERE de.delivery_id = ?
                ORDER BY de.earned_at DESC
                LIMIT 10
            `, [delivery_id]);

            // Convert string values to numbers for revenue fields
            const stats = statsResult[0];
            const earnings = earningsResult[0];

            if (stats) {
                stats.total_revenue = parseFloat(stats.total_revenue) || 0;
                stats.today_revenue = parseFloat(stats.today_revenue) || 0;
                stats.this_month_revenue = parseFloat(stats.this_month_revenue) || 0;
                stats.avg_delivery_time = parseFloat(stats.avg_delivery_time) || 0;
            }

            if (earnings) {
                earnings.total_earnings = parseFloat(earnings.total_earnings) || 0;
                earnings.this_month_earnings = parseFloat(earnings.this_month_earnings) || 0;
                earnings.this_week_earnings = parseFloat(earnings.this_week_earnings) || 0;
                earnings.today_earnings = parseFloat(earnings.today_earnings) || 0;
            }

            res.json({
                success: true,
                data: {
                    ...stats,
                    earnings: earnings || {},
                    recent_earnings: recentEarningsResult
                },
                message: 'Delivery statistics retrieved successfully'
            });

        } catch (error) {
            console.error('Error getting delivery stats:', error);
            res.status(500).json({
                success: false,
                error: 'Failed to get delivery statistics',
                details: error.message
            });
        }
    }

    static async getDeliveryPersonnelById(req, res) {
        try {
            const { id } = req.params;

            const [personnel] = await pool.execute(`
                SELECT 
                    dp.delivery_id,
                    u.name,
                    u.email,
                    u.phone,
                    COALESCE(dz.name_en, '') as zone,
                    dp.vehicle_type,
                    dp.vehicle_number,
                    dp.is_available,
                    dp.rating,
                    dp.total_deliveries,
                    dp.is_verified
                FROM delivery_personnel dp
                JOIN users u ON dp.user_id = u.user_id
                LEFT JOIN delivery_zones dz ON dp.zone_id = dz.zone_id
                WHERE dp.delivery_id = ?
            `, [id]);

            if (personnel.length === 0) {
                return res.status(404).json({ success: false, error: 'Delivery personnel not found' });
            }

            res.json({
                success: true,
                data: personnel[0],
                message: 'Delivery personnel retrieved successfully'
            });

        } catch (error) {
            console.error('Error getting delivery personnel by ID:', error);
            res.status(500).json({
                success: false,
                error: 'Failed to get delivery personnel',
                details: error.message
            });
        }
    }

    static async createDeliveryPersonnel(req, res) {
        try {
            const {
                name,
                email,
                password,
                phone,
                address,
                profile_image,
                zone_id,
                vehicle_type,
                vehicle_number,
                is_available,
                is_verified
            } = req.body;

            // Check if user with email exists
            const existingUser = await User.findByEmail(email);
            let user_id;
            if (existingUser) {
                // If user exists but is not delivery personnel, block
                if (existingUser.role_id !== 6) {
                    return res.status(409).json({ success: false, error: 'Email already exists' });
                }
                // If user is already delivery, check if already in delivery_personnel
                const existingPersonnel = await DeliveryPersonnel.findByUserId(existingUser.user_id);
                if (existingPersonnel) {
                    return res.status(409).json({ success: false, error: 'Delivery personnel already exists for this email' });
                }
                user_id = existingUser.user_id;
            } else {
                // Create user (roleId 6 = Delivery Personnel)
                const userResult = await User.create({
                    roleId: 6,
                    name,
                    email,
                    password,
                    phone,
                    address,
                    profile_image
                });
                user_id = userResult.user_id;
            }

            // Helper: convert undefined to null for DB
            function safe(val) { return val === undefined ? null : val; }

            // Create delivery personnel
            const deliveryPersonnelId = await DeliveryPersonnel.create({
                user_id,
                zone_id: safe(zone_id),
                vehicle_type: safe(vehicle_type),
                vehicle_number: safe(vehicle_number),
                is_available: safe(is_available),
                is_verified: safe(is_verified),
                rating: 0,
                total_deliveries: 0
            });

            // Return created personnel (fetch full info)
            const personnel = await DeliveryPersonnel.findById(deliveryPersonnelId);
            res.status(201).json({ success: true, data: personnel, message: 'Delivery personnel created successfully' });
        } catch (error) {
            if (error.message && error.message.includes('Email already exists')) {
                return res.status(409).json({ success: false, error: 'Email already exists' });
            }
            if (error.message && error.message.includes('Delivery personnel already exists')) {
                return res.status(409).json({ success: false, error: 'Delivery personnel already exists for this email' });
            }
            console.error('Error creating delivery personnel:', error);
            res.status(500).json({ success: false, error: 'Failed to create delivery personnel', details: error.message });
        }
    }

    static async updateDeliveryPersonnel(req, res) {
        const { pool } = require('../db/db');
        let connection;
        try {
            const { id } = req.params;
            const {
                name,
                email,
                phone,
                zone_id,
                vehicle_type,
                vehicle_number,
                is_available,
                is_verified
            } = req.body;

            connection = await pool.getConnection();

            // Check if delivery personnel exists
            const [existingPersonnel] = await connection.query(
                'SELECT dp.*, u.email FROM delivery_personnel dp JOIN users u ON dp.user_id = u.user_id WHERE dp.delivery_id = ?',
                [id]
            );

            if (existingPersonnel.length === 0) {
                connection.release();
                return res.status(404).json({ success: false, error: 'Delivery personnel not found' });
            }

            const personnel = existingPersonnel[0];

            // Begin transaction
            await connection.query('START TRANSACTION');

            try {
                // Update user information
                await connection.query(
                    'UPDATE users SET name = ?, phone = ? WHERE user_id = ?',
                    [name, phone, personnel.user_id]
                );

                // Update delivery personnel information
                await connection.query(
                    'UPDATE delivery_personnel SET zone_id = ?, vehicle_type = ?, vehicle_number = ?, is_available = ?, is_verified = ? WHERE delivery_id = ?',
                    [zone_id || null, vehicle_type || null, vehicle_number || null, is_available ? 1 : 0, is_verified ? 1 : 0, id]
                );

                await connection.query('COMMIT');

                // Return updated personnel
                const [updatedPersonnel] = await connection.query(`
                    SELECT 
                        dp.delivery_id,
                        u.name,
                        u.email,
                        u.phone,
                        COALESCE(dz.name_en, '') as zone,
                        dp.vehicle_type,
                        dp.vehicle_number,
                        dp.is_available,
                        dp.rating,
                        dp.total_deliveries,
                        dp.is_verified
                    FROM delivery_personnel dp
                    JOIN users u ON dp.user_id = u.user_id
                    LEFT JOIN delivery_zones dz ON dp.zone_id = dz.zone_id
                    WHERE dp.delivery_id = ?
                `, [id]);

                res.json({
                    success: true,
                    data: updatedPersonnel[0],
                    message: 'Delivery personnel updated successfully'
                });

            } catch (error) {
                await connection.query('ROLLBACK');
                throw error;
            } finally {
                connection.release();
            }

        } catch (error) {
            if (connection) connection.release();
            console.error('Error updating delivery personnel:', error);
            res.status(500).json({
                success: false,
                error: 'Failed to update delivery personnel',
                details: error.message
            });
        }
    }

    static async confirmPayment(req, res) {
        try {
            const { order_id, payment_received, customer_signature, delivery_photo, notes } = req.body;
            const delivery_id = req.user.delivery_id;

            // Validate required fields
            if (!order_id || !payment_received) {
                return res.status(400).json({
                    success: false,
                    error: 'Order ID and payment amount are required'
                });
            }

            // Check if delivery personnel is assigned to this order (check both delivery_assignments and orders tables)
            const [assignmentResult] = await pool.execute(
                'SELECT * FROM delivery_assignments WHERE order_id = ? AND delivery_id = ?',
                [order_id, delivery_id]
            );

            const [orderAssignmentResult] = await pool.execute(
                'SELECT order_id FROM orders WHERE order_id = ? AND delivery_id = ?',
                [order_id, delivery_id]
            );

            if (assignmentResult.length === 0 && orderAssignmentResult.length === 0) {
                return res.status(403).json({
                    success: false,
                    error: 'You are not assigned to this order'
                });
            }

            // Get order details
            const [orderResult] = await pool.execute(
                'SELECT * FROM orders WHERE order_id = ? AND payment_method = "cash"',
                [order_id]
            );

            if (orderResult.length === 0) {
                return res.status(404).json({
                    success: false,
                    error: 'Order not found or not a cash payment order'
                });
            }

            const order = orderResult[0];

            // Validate payment amount
            if (parseFloat(payment_received) !== parseFloat(order.total)) {
                return res.status(400).json({
                    success: false,
                    error: `Payment amount must match order total: ${order.total} ل.س`
                });
            }

            // Check if payment already confirmed
            const [existingConfirmation] = await pool.execute(
                'SELECT * FROM payment_confirmations WHERE order_id = ?',
                [order_id]
            );

            if (existingConfirmation.length > 0) {
                return res.status(400).json({
                    success: false,
                    error: 'Payment already confirmed for this order'
                });
            }

            // Begin transaction
            await pool.execute('START TRANSACTION');

            try {
                // Create payment confirmation record
                await pool.execute(
                    'INSERT INTO payment_confirmations (order_id, delivery_id, payment_received, payment_method, customer_signature, delivery_photo, notes) VALUES (?, ?, ?, ?, ?, ?, ?)',
                    [order_id, delivery_id, payment_received, 'cash', customer_signature || null, delivery_photo || null, notes || null]
                );

                // Update payment status to paid
                await pool.execute(
                    'UPDATE payments SET status = ?, processed_at = NOW() WHERE order_id = ?',
                    ['paid', order_id]
                );

                // Update order status to delivered
                await pool.execute(
                    'UPDATE orders SET status = ?, actual_delivery_time = NOW() WHERE order_id = ?',
                    ['delivered', order_id]
                );

                // Create delivery tracking entry
                await pool.execute(
                    'INSERT INTO delivery_tracking (order_id, delivery_id, status, notes) VALUES (?, ?, "delivered", "Payment confirmed and order delivered")',
                    [order_id, delivery_id]
                );

                // Update delivery assignment status (if exists)
                await pool.execute(
                    'UPDATE delivery_assignments SET status = "completed" WHERE order_id = ? AND delivery_id = ?',
                    [order_id, delivery_id]
                );

                // Make delivery personnel available again
                await pool.execute(
                    'UPDATE delivery_personnel SET is_available = 1, total_deliveries = total_deliveries + 1 WHERE delivery_id = ?',
                    [delivery_id]
                );

                await pool.execute('COMMIT');

                res.json({
                    success: true,
                    message: 'Payment confirmed and order delivered successfully',
                    data: {
                        order_id,
                        payment_received,
                        order_total: order.total,
                        delivery_id
                    }
                });

            } catch (error) {
                await pool.execute('ROLLBACK');
                throw error;
            }

        } catch (error) {
            console.error('Error confirming payment:', error);
            res.status(500).json({
                success: false,
                error: 'Failed to confirm payment',
                details: error.message
            });
        }
    }

    // Create a new delivery zone (Admin only)
    static async createDeliveryZone(req, res) {
        try {
            const { name_en, name_ar, description, delivery_fee, estimated_delivery_time } = req.body;
            if (!name_en || !name_ar) {
                return res.status(400).json({ success: false, error: 'Zone names are required' });
            }
            const result = await DeliveryZone.create({
                name_en,
                name_ar,
                description,
                delivery_fee,
                estimated_delivery_time,
                is_active: 1
            });
            res.status(201).json({ success: true, data: result, message: 'Delivery zone created successfully' });
        } catch (error) {
            console.error('Error creating delivery zone:', error);
            res.status(500).json({ success: false, error: 'Failed to create delivery zone', details: error.message });
        }
    }

    // Update a delivery zone (Admin only)
    static async updateDeliveryZone(req, res) {
        try {
            const { zoneId } = req.params;
            const updateData = req.body;
            if (!zoneId) {
                return res.status(400).json({ success: false, error: 'Zone ID is required' });
            }
            await DeliveryZone.update(zoneId, updateData);
            res.json({ success: true, message: 'Delivery zone updated successfully' });
        } catch (error) {
            console.error('Error updating delivery zone:', error);
            res.status(500).json({ success: false, error: 'Failed to update delivery zone', details: error.message });
        }
    }

    // Delete a delivery zone (Admin only)
    static async deleteDeliveryZone(req, res) {
        try {
            const { zoneId } = req.params;
            if (!zoneId) {
                return res.status(400).json({ success: false, error: 'Zone ID is required' });
            }
            await DeliveryZone.delete(zoneId);
            res.json({ success: true, message: 'Delivery zone deleted successfully' });
        } catch (error) {
            console.error('Error deleting delivery zone:', error);
            res.status(500).json({ success: false, error: 'Failed to delete delivery zone', details: error.message });
        }
    }

    static async deleteDeliveryPersonnel(req, res) {
        const { pool } = require('../db/db');
        let connection;
        try {
            const { id } = req.params;
            connection = await pool.getConnection();

            // Check if delivery personnel exists
            const [existingPersonnel] = await connection.query(
                'SELECT dp.*, u.email FROM delivery_personnel dp JOIN users u ON dp.user_id = u.user_id WHERE dp.delivery_id = ?',
                [id]
            );

            if (existingPersonnel.length === 0) {
                connection.release();
                return res.status(404).json({ success: false, error: 'Delivery personnel not found' });
            }

            const personnel = existingPersonnel[0];

            // Check if personnel has active assignments
            const [activeAssignments] = await connection.query(
                'SELECT COUNT(*) as count FROM delivery_assignments WHERE delivery_id = ? AND status IN ("assigned", "in_progress")',
                [id]
            );

            if (activeAssignments[0].count > 0) {
                connection.release();
                return res.status(400).json({
                    success: false,
                    error: 'Cannot delete delivery personnel with active assignments'
                });
            }

            // Begin transaction
            await connection.query('START TRANSACTION');

            try {
                // Delete delivery personnel record
                await connection.query('DELETE FROM delivery_personnel WHERE delivery_id = ?', [id]);

                // Note: We don't delete the user account as it might be used for other purposes
                // If you want to delete the user account as well, uncomment the following line:
                // await connection.query('DELETE FROM users WHERE user_id = ?', [personnel.user_id]);

                await connection.query('COMMIT');

                res.json({
                    success: true,
                    message: 'Delivery personnel deleted successfully'
                });
            } catch (error) {
                await connection.query('ROLLBACK');
                throw error;
            } finally {
                connection.release();
            }

        } catch (error) {
            if (connection) connection.release();
            console.error('Error deleting delivery personnel:', error);
            res.status(500).json({
                success: false,
                error: 'Failed to delete delivery personnel',
                details: error.message
            });
        }
    }

    // Debug endpoint to check database state
    static async debugDatabaseState(req, res) {
        try {
            const delivery_id = req.user.delivery_id;

            // Check delivery personnel
            const [deliveryResult] = await pool.execute(
                'SELECT * FROM delivery_personnel WHERE delivery_id = ?',
                [delivery_id]
            );

            // Check processing orders
            const [processingOrders] = await pool.execute(
                'SELECT order_id, delivery_zone_id, status FROM orders WHERE status = "processing"'
            );

            // Check zones
            const [zones] = await pool.execute(
                'SELECT zone_id, name_en FROM delivery_zones'
            );

            // Check all orders
            const [allOrders] = await pool.execute(
                'SELECT order_id, delivery_zone_id, status FROM orders ORDER BY order_id DESC LIMIT 10'
            );

            // Check all delivery assignments
            const [assignments] = await pool.execute(
                'SELECT assignment_id, order_id, delivery_id, assigned_by, status, notes FROM delivery_assignments'
            );

            // Check all delivery personnel
            const [allDeliveryPersonnel] = await pool.execute(
                'SELECT delivery_id, user_id, zone_id, is_available FROM delivery_personnel'
            );

            res.json({
                success: true,
                data: {
                    delivery_personnel: deliveryResult,
                    processing_orders: processingOrders,
                    zones: zones,
                    all_orders: allOrders,
                    assignments: assignments,
                    all_delivery_personnel: allDeliveryPersonnel,
                    user: req.user
                }
            });
        } catch (error) {
            console.error('Debug error:', error);
            res.status(500).json({
                success: false,
                error: 'Debug failed',
                details: error.message
            });
        }
    }

    // Create test order for debugging
    static async createTestOrder(req, res) {
        try {
            // Create a test order with processing status
            const [result] = await pool.execute(`
                INSERT INTO orders (
                    customer_id, 
                    total, 
                    delivery_fee, 
                    status, 
                    delivery_zone_id,
                    placed_at
                ) VALUES (1, 100.00, 10.00, 'processing', 1, NOW())
            `);

            const orderId = result.insertId;

            // Add some order items
            await pool.execute(`
                INSERT INTO order_items (
                    order_id, 
                    product_id, 
                    quantity, 
                    unit_price, 
                    total_price
                ) VALUES (?, 1, 2, 50.00, 100.00)
            `, [orderId]);

            res.json({
                success: true,
                data: {
                    order_id: orderId,
                    message: 'Test order created successfully'
                }
            });
        } catch (error) {
            console.error('Error creating test order:', error);
            res.status(500).json({
                success: false,
                error: 'Failed to create test order',
                details: error.message
            });
        }
    }

    // Get available orders for delivery personnel to claim
    static async getAvailableOrdersForClaim(req, res) {
        try {
            const delivery_id = req.user.delivery_id;

            if (!delivery_id) {
                return res.status(400).json({
                    success: false,
                    error: 'Delivery ID not found. Please contact administrator.'
                });
            }

            const { page = 1, limit = 20 } = req.query;
            const offset = (parseInt(page) - 1) * parseInt(limit);

            // Get delivery personnel zone and availability
            const [deliveryResult] = await pool.execute(
                'SELECT zone_id, is_available FROM delivery_personnel WHERE delivery_id = ?',
                [delivery_id]
            );

                        if (deliveryResult.length === 0) {
                // Check if user exists and is delivery personnel
                const [userResult] = await pool.execute(
                    'SELECT user_id, role_id FROM users WHERE user_id = ? AND role_id = 6',
                    [req.user.id]
                );

                if (userResult.length === 0) {
                    return res.status(400).json({
                        success: false,
                        error: 'User not found or not a delivery personnel'
                    });
                }

                // Create delivery personnel record if it doesn't exist
                await pool.execute(
                    'INSERT INTO delivery_personnel (delivery_id, user_id, zone_id, is_available) VALUES (?, ?, 1, 1)',
                    [delivery_id, req.user.id]
                );
                                // Fetch the newly created record
                const [newDeliveryResult] = await pool.execute(
                    'SELECT zone_id, is_available FROM delivery_personnel WHERE delivery_id = ?',
                    [delivery_id]
                );
                deliveryResult[0] = newDeliveryResult[0];
            }

            // If delivery personnel is not available, automatically set them as available
            if (deliveryResult[0].is_available === 0) {
                await pool.execute(
                    'UPDATE delivery_personnel SET is_available = 1 WHERE delivery_id = ?',
                    [delivery_id]
                );
            }

            // Check if delivery personnel has a zone assigned
            if (!deliveryResult[0].zone_id) {
                return res.status(400).json({
                    success: false,
                    error: 'You are not assigned to any delivery zone. Please contact administrator.'
                });
            }

            const zone_id = deliveryResult[0].zone_id;

            // Debug: Check if there are any processing orders
            const [debugOrders] = await pool.execute(`
                SELECT COUNT(*) as total_processing FROM orders WHERE status = 'processing'
            `);
                        // Debug: Check orders in the same zone
            const [debugZoneOrders] = await pool.execute(`
                SELECT COUNT(*) as total_in_zone FROM orders 
                WHERE status = 'processing' AND delivery_zone_id = ?
            `, [zone_id]);
                        // Get available orders in the same zone
            const [ordersResult] = await pool.execute(`
                SELECT 
                    o.order_id,
                    o.customer_id,
                    o.total,
                    o.delivery_fee,
                    o.status,
                    o.placed_at,
                    o.delivery_zone_id,
                    dz.name_en as zone_name,
                    dz.name_ar as zone_name_ar,
                    u.name as customer_name,
                    u.phone as customer_phone,
                    da.address as delivery_address,
                    da.phone as delivery_phone,
                    -- Check if order is already claimed
                    CASE WHEN dcr.claim_id IS NOT NULL THEN 1 ELSE 0 END as is_claimed,
                    dcr.claim_status as claim_status,
                    dcr.claimed_at as claimed_at,
                    -- Delivery personnel info if claimed
                    dp_claimed.delivery_id as claimed_by_delivery_id,
                    u_claimed.name as claimed_by_name,
                    -- Check if current delivery personnel can claim
                    CASE 
                        WHEN dcr.claim_id IS NULL OR dcr.claim_status IN ('rejected', 'cancelled') THEN 1 
                        ELSE 0 
                    END as can_claim
                FROM orders o
                LEFT JOIN delivery_zones dz ON o.delivery_zone_id = dz.zone_id
                LEFT JOIN users u ON o.customer_id = u.user_id
                LEFT JOIN delivery_addresses da ON o.address_id = da.address_id
                LEFT JOIN delivery_claim_requests dcr ON o.order_id = dcr.order_id
                LEFT JOIN delivery_personnel dp_claimed ON dcr.delivery_id = dp_claimed.delivery_id
                LEFT JOIN users u_claimed ON dp_claimed.user_id = u_claimed.user_id
                WHERE o.status = 'processing' 
                    AND o.delivery_id IS NULL
                    AND o.delivery_zone_id = ?
                    AND (dcr.claim_id IS NULL OR dcr.claim_status IN ('rejected', 'cancelled'))
                ORDER BY o.placed_at ASC
                LIMIT ? OFFSET ?
            `, [zone_id, parseInt(limit), offset]);

                        // Get total count for pagination
            const [countResult] = await pool.execute(`
                SELECT COUNT(*) as total
                FROM orders o
                LEFT JOIN delivery_claim_requests dcr ON o.order_id = dcr.order_id
                WHERE o.status = 'processing' 
                    AND o.delivery_id IS NULL
                    AND o.delivery_zone_id = ?
                    AND (dcr.claim_id IS NULL OR dcr.claim_status IN ('rejected', 'cancelled'))
            `, [zone_id]);

            res.json({
                success: true,
                data: {
                    orders: ordersResult,
                    pagination: {
                        total: countResult[0].total,
                        page: parseInt(page),
                        limit: parseInt(limit),
                        total_pages: Math.ceil(countResult[0].total / parseInt(limit))
                    }
                },
                message: 'Available orders for claim retrieved successfully'
            });

        } catch (error) {
            console.error('Error getting available orders for claim:', error);
            res.status(500).json({
                success: false,
                error: 'Failed to get available orders for claim',
                details: error.message
            });
        }
    }

    // Claim an order for delivery
    static async claimOrder(req, res) {
        try {
            const { order_id } = req.params;
            const { notes } = req.body;
            const delivery_id = req.user.delivery_id;

            if (!delivery_id) {
                return res.status(400).json({
                    success: false,
                    error: 'Delivery ID not found. Please contact administrator.'
                });
            }

            // Check if order exists and is available for claim
            const [orderCheck] = await pool.execute(`
                SELECT o.order_id, o.status, o.delivery_zone_id, o.delivery_id,
                       dp.zone_id as delivery_personnel_zone_id, dp.is_available
                FROM orders o
                LEFT JOIN delivery_personnel dp ON dp.delivery_id = ?
                WHERE o.order_id = ?
            `, [delivery_id, order_id]);

            if (orderCheck.length === 0) {
                return res.status(404).json({
                    success: false,
                    error: 'Order not found'
                });
            }

            const order = orderCheck[0];

            // Check if order is in correct status
            if (order.status !== 'processing') {
                return res.status(400).json({
                    success: false,
                    error: 'Order is not in processing status'
                });
            }

            // Check if order is already assigned
            if (order.delivery_id) {
                return res.status(400).json({
                    success: false,
                    error: 'Order is already assigned to another delivery personnel'
                });
            }

            // Check if delivery personnel is in the same zone
            if (order.delivery_zone_id !== order.delivery_personnel_zone_id) {
                return res.status(400).json({
                    success: false,
                    error: 'Order is not in your delivery zone'
                });
            }

            // Check if delivery personnel is available
            if (!order.is_available) {
                return res.status(400).json({
                    success: false,
                    error: 'You are not available for delivery'
                });
            }

            // Check if order is already claimed
            const [existingClaim] = await pool.execute(`
                SELECT claim_id, claim_status FROM delivery_claim_requests 
                WHERE order_id = ? AND claim_status NOT IN ('rejected', 'cancelled')
            `, [order_id]);

            if (existingClaim.length > 0) {
                return res.status(400).json({
                    success: false,
                    error: 'Order is already claimed by another delivery personnel'
                });
            }

            // Create claim request with pending status first
            const [claimResult] = await pool.execute(`
                INSERT INTO delivery_claim_requests (order_id, delivery_id, claim_status, notes, claimed_at)
                VALUES (?, ?, 'pending', ?, NOW())
            `, [order_id, delivery_id, notes || null]);

            // Update claim status to approved to trigger the assignment
            await pool.execute(`
                UPDATE delivery_claim_requests 
                SET claim_status = 'approved', approved_at = NOW()
                WHERE order_id = ? AND delivery_id = ?
            `, [order_id, delivery_id]);

            // The trigger will handle creating the delivery assignment record

            // Create delivery tracking record
            await pool.execute(`
                INSERT INTO delivery_tracking (order_id, delivery_id, status, notes, timestamp)
                VALUES (?, ?, 'assigned', ?, NOW())
            `, [order_id, delivery_id, notes || 'Order claimed and assigned to delivery personnel']);

            res.json({
                success: true,
                message: 'Order claimed and assigned successfully',
                data: {
                    order_id: order_id,
                    delivery_id: delivery_id,
                    claimed_at: new Date(),
                    status: 'assigned'
                }
            });

        } catch (error) {
            console.error('Error claiming order:', error);

            // Handle specific error messages
            let errorMessage = 'Failed to claim order';
            if (error.message.includes('Order not found')) {
                errorMessage = 'Order not found';
            } else if (error.message.includes('processing status')) {
                errorMessage = 'Order is not in processing status';
            } else if (error.message.includes('already claimed')) {
                errorMessage = 'Order is already claimed by another delivery personnel';
            } else if (error.message.includes('delivery zone')) {
                errorMessage = 'Order is not in your delivery zone';
            } else if (error.message.includes('not available')) {
                errorMessage = 'You are not available for delivery';
            }

            res.status(400).json({
                success: false,
                error: errorMessage,
                details: error.message
            });
        }
    }

    // Cancel a claimed order
    static async cancelClaim(req, res) {
        try {
            const { order_id } = req.params;
            const delivery_id = req.user.delivery_id;

            if (!delivery_id) {
                return res.status(400).json({
                    success: false,
                    error: 'Delivery ID not found. Please contact administrator.'
                });
            }

            // Check if the claim exists and belongs to this delivery personnel
            const [claimCheck] = await pool.execute(`
                SELECT claim_id, claim_status FROM delivery_claim_requests 
                WHERE order_id = ? AND delivery_id = ? AND claim_status = 'approved'
            `, [order_id, delivery_id]);

            if (claimCheck.length === 0) {
                return res.status(404).json({
                    success: false,
                    error: 'Claim not found or not approved'
                });
            }

            // Update claim status to cancelled
            await pool.execute(`
                UPDATE delivery_claim_requests 
                SET claim_status = 'cancelled'
                WHERE order_id = ? AND delivery_id = ?
            `, [order_id, delivery_id]);
            await pool.execute(`
          UPDATE orders
SET status = 'pending',
    delivery_id = NULL
WHERE order_id = ? AND delivery_id = ?;
            `, [order_id, delivery_id]);

            // The trigger will handle removing the delivery assignment record

            // The trigger will handle removing the order assignment

            // Create delivery tracking record for cancellation
            await pool.execute(`
                INSERT INTO delivery_tracking (order_id, delivery_id, status, notes, timestamp)
                VALUES (?, ?, 'cancelled', 'Order claim cancelled by delivery personnel', NOW())
            `, [order_id, delivery_id]);

            res.json({
                success: true,
                message: 'Claim cancelled successfully',
                data: {
                    order_id: order_id,
                    delivery_id: delivery_id
                }
            });

        } catch (error) {
            console.error('Error cancelling claim:', error);

            let errorMessage = 'Failed to cancel claim';
            if (error.message.includes('Claim not found')) {
                errorMessage = 'Claim not found';
            } else if (error.message.includes('cannot be cancelled')) {
                errorMessage = 'Claim cannot be cancelled';
            }

            res.status(400).json({
                success: false,
                error: errorMessage,
                details: error.message
            });
        }
    }

    // Get delivery personnel's claimed orders
    static async getMyClaimedOrders(req, res) {
        try {
            const delivery_id = req.user.delivery_id;

            if (!delivery_id) {
                return res.status(400).json({
                    success: false,
                    error: 'Delivery ID not found. Please contact administrator.'
                });
            }

            const { page = 1, limit = 20, status } = req.query;
            const offset = (parseInt(page) - 1) * parseInt(limit);

            let statusFilter = '';
            let params = [delivery_id];

            if (status) {
                statusFilter = 'AND dcr.claim_status = ?';
                params.push(status);
            }

            // Get claimed orders
            const [ordersResult] = await pool.execute(`
                SELECT 
                    o.order_id,
                    o.customer_id,
                    o.total,
                    o.delivery_fee,
                    o.status,
                    o.placed_at,
                    o.delivery_zone_id,
                    dz.name_en as zone_name,
                    dz.name_ar as zone_name_ar,
                    u.name as customer_name,
                    u.phone as customer_phone,
                    da.address as delivery_address,
                    da.phone as delivery_phone,
                    dcr.claim_id,
                    dcr.claim_status,
                    dcr.claimed_at,
                    dcr.approved_at,
                    dcr.notes as claim_notes,
                    dp.delivery_id,
                    dp.vehicle_type,
                    dp.vehicle_number
                FROM orders o
                JOIN delivery_claim_requests dcr ON o.order_id = dcr.order_id
                JOIN delivery_personnel dp ON dcr.delivery_id = dp.delivery_id
                LEFT JOIN delivery_zones dz ON o.delivery_zone_id = dz.zone_id
                LEFT JOIN users u ON o.customer_id = u.user_id
                LEFT JOIN delivery_addresses da ON o.address_id = da.address_id
                WHERE dcr.delivery_id = ? ${statusFilter}
                ORDER BY dcr.claimed_at DESC
                LIMIT ? OFFSET ?
            `, [...params, parseInt(limit), offset]);

            // Get total count for pagination
            const [countResult] = await pool.execute(`
                SELECT COUNT(*) as total
                FROM delivery_claim_requests dcr
                WHERE dcr.delivery_id = ? ${statusFilter}
            `, params);

            res.json({
                success: true,
                data: {
                    orders: ordersResult,
                    pagination: {
                        total: countResult[0].total,
                        page: parseInt(page),
                        limit: parseInt(limit),
                        total_pages: Math.ceil(countResult[0].total / parseInt(limit))
                    }
                },
                message: 'Claimed orders retrieved successfully'
            });

        } catch (error) {
            console.error('Error getting claimed orders:', error);
            res.status(500).json({
                success: false,
                error: 'Failed to get claimed orders',
                details: error.message
            });
        }
    }

    // Check if delivery personnel can claim an order
    static async checkCanClaimOrder(req, res) {
        try {
            const { order_id } = req.params;
            const delivery_id = req.user.delivery_id;

            if (!delivery_id) {
                return res.status(400).json({
                    success: false,
                    error: 'Delivery ID not found. Please contact administrator.'
                });
            }

            // Use the function to check if can claim
            const [result] = await pool.execute(
                'SELECT CanDeliveryPersonnelClaimOrder(?, ?) as can_claim',
                [order_id, delivery_id]
            );

            const canClaim = result[0].can_claim === 1;

            res.json({
                success: true,
                data: {
                    order_id: order_id,
                    delivery_id: delivery_id,
                    can_claim: canClaim
                },
                message: canClaim ? 'Order can be claimed' : 'Order cannot be claimed'
            });

        } catch (error) {
            console.error('Error checking if can claim order:', error);
            res.status(500).json({
                success: false,
                error: 'Failed to check if order can be claimed',
                details: error.message
            });
        }
    }
}

module.exports = DeliveryController; 