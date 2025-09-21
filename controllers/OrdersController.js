// Orders Controller 

const Order = require('../models/Order');
const Cart = require('../models/Cart');
const VendorSubscription = require('../models/VendorSubscription');
const VendorPayment = require('../models/VendorPayment');
const { pool } = require('../db/db');
const enhancedNotificationService = require('../services/enhancedNotificationService');
const { console } = require('inspector');
async function getOrders(req, res) {
    try {
        const user_id = req.user.id;
        const userRole = req.user.roleId;

        const page = parseInt(req.query.page) || 1;
        let limit = req.query.limit !== undefined ? parseInt(req.query.limit) : 20;
        let offset = (page - 1) * limit;
        const search = req.query.search || '';

        // If limit=0, fetch all (no pagination)
        if (limit === 0) {
            offset = 0;
        }

        // 🔍 Debug request input
        console.debug('[getOrders] Request Params:', {
            user_id,
            userRole,
            page,
            limit,
            offset,
            search
        });

        let orders, total;

        // Different access based on user role
        if (userRole === 2) { // Customer - only their own orders
            orders = await Order.findByCustomer(user_id);
            total = orders.length;

            // 🔍 Debug DB result
            console.debug('[getOrders] Customer Orders Count:', total);

        } else if (userRole === 3 || userRole === 4 || userRole === 5) { // Vendor
            const vendorResult = await Order.findByVendor(user_id, { limit, offset, search });
            orders = vendorResult.orders;
            total = vendorResult.total;

            // 🔍 Debug DB result
            console.debug('[getOrders] Vendor Orders Result:', {
                ordersCount: orders?.length || 0,
                total
            });

        } else { // Admin
            const result = await Order.findAllWithPaginationAndSearch({ limit, offset, search });
            orders = result.orders;
            total = result.total;

            // 🔍 Debug DB result
            console.debug('[getOrders] Admin Orders Result:', {
                ordersCount: orders?.length || 0,
                total
            });
        }

        // Enhance orders with delivery information
        const enhancedOrders = await Promise.all(orders.map(async (order) => {
            const enhancedOrder = { ...(typeof order.toJSON === 'function' ? order.toJSON() : order) };

            if (order.estimated_delivery_time) {
                enhancedOrder.estimated_delivery_date = new Date(order.estimated_delivery_time).toLocaleDateString('en-US', {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric'
                });
                enhancedOrder.estimated_delivery_time_formatted = new Date(order.estimated_delivery_time).toLocaleTimeString('en-US', {
                    hour: '2-digit',
                    minute: '2-digit'
                });
            }

            if (order.actual_delivery_time) {
                enhancedOrder.actual_delivery_date = new Date(order.actual_delivery_time).toLocaleDateString('en-US', {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric'
                });
                enhancedOrder.actual_delivery_time_formatted = new Date(order.actual_delivery_time).toLocaleTimeString('en-US', {
                    hour: '2-digit',
                    minute: '2-digit'
                });
            }

            enhancedOrder.delivery_status = getDeliveryStatus(order.status);
            enhancedOrder.delivery_progress = getDeliveryProgress(order.status);

            if (order.delivery_id) {
                const [deliveryInfo] = await pool.execute(`
                    SELECT dp.*, u.name as delivery_person_name, u.phone as delivery_person_phone,
                           dz.name_en as delivery_zone_name
                    FROM delivery_personnel dp
                    JOIN users u ON dp.user_id = u.user_id
                    LEFT JOIN delivery_zones dz ON dp.zone_id = dz.zone_id
                    WHERE dp.delivery_id = ?
                `, [order.delivery_id]);

                if (deliveryInfo.length > 0) {
                    enhancedOrder.delivery_personnel = deliveryInfo[0];
                }

                enhancedOrder.delivery_tracking = await getDeliveryTracking(order.order_id);
            }

            return enhancedOrder;
        }));

        // 🔍 Debug final output before sending
        console.debug('[getOrders] Response Summary:', {
            total,
            totalPages: limit > 0 ? Math.ceil(total / limit) : 1,
            ordersReturned: enhancedOrders.length
        });

        res.json({
            success: true,
            data: enhancedOrders,
            pagination: {
                page,
                limit,
                total,
                totalPages: limit > 0 ? Math.ceil(total / limit) : 1
            }
        });

    } catch (error) {
        console.error('Error fetching orders:', error);
        res.status(500).json({ error: 'Server Error', details: error.message });
    }
}


async function getOrderById(req, res) {
    try {
        const { id } = req.params;
        const user_id = req.user.id;
        const userRole = req.user.roleId;

        const order = await Order.findById(id);

        if (!order) {
            return res.status(404).json({
                success: false,
                error: 'Order not found'
            });
        }

        // Check permissions based on user role
        if (userRole === 2) { // Customer - can only see their own orders
            if (order.customer_id != user_id) {
                return res.status(403).json({
                    success: false,
                    error: 'Access denied'
                });
            }
        } else if (userRole === 3 || userRole === 4 || userRole === 5) { // Vendor - can only see orders containing their products
            const hasVendor = await Order.hasVendorInOrder(id, user_id);
            if (!hasVendor) {
                return res.status(403).json({
                    success: false,
                    error: 'Access denied'
                });
            }
        }
        // Admin (role 1) can see any order

        // Get order items (with vendor and delivery info)
        const items = await Order.getOrderItems(id);
        order.items = items;

        // Enhance order with delivery information
        const enhancedOrder = { ...order };

        // Add delivery time information
        if (order.estimated_delivery_time) {
            enhancedOrder.estimated_delivery_date = new Date(order.estimated_delivery_time).toLocaleDateString('en-US', {
                year: 'numeric',
                month: 'long',
                day: 'numeric'
            });
            enhancedOrder.estimated_delivery_time_formatted = new Date(order.estimated_delivery_time).toLocaleTimeString('en-US', {
                hour: '2-digit',
                minute: '2-digit'
            });
        }

        if (order.actual_delivery_time) {
            enhancedOrder.actual_delivery_date = new Date(order.actual_delivery_time).toLocaleDateString('en-US', {
                year: 'numeric',
                month: 'long',
                day: 'numeric'
            });
            enhancedOrder.actual_delivery_time_formatted = new Date(order.actual_delivery_time).toLocaleTimeString('en-US', {
                hour: '2-digit',
                minute: '2-digit'
            });
        }

        // Add delivery status information
        enhancedOrder.delivery_status = getDeliveryStatus(order.status);
        enhancedOrder.delivery_progress = getDeliveryProgress(order.status);

        // Add delivery personnel information if assigned
        if (order.delivery_id) {
            const [deliveryInfo] = await pool.execute(`
                SELECT dp.*, u.name as delivery_person_name, u.phone as delivery_person_phone,
                       dz.name_en as delivery_zone_name
                FROM delivery_personnel dp
                JOIN users u ON dp.user_id = u.user_id
                LEFT JOIN delivery_zones dz ON dp.zone_id = dz.zone_id
                WHERE dp.delivery_id = ?
            `, [order.delivery_id]);

            if (deliveryInfo.length > 0) {
                enhancedOrder.delivery_personnel = deliveryInfo[0];
            }
        }

        // Add delivery tracking information if available
        if (order.delivery_id) {
            enhancedOrder.delivery_tracking = await getDeliveryTracking(id);
        }

        res.json({
            success: true,
            data: enhancedOrder,
            message: 'Order retrieved successfully'
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({
            success: false,
            error: 'Server Error',
            details: error.message
        });
    }
}

// Helper functions for delivery information
function getDeliveryStatus(status) {
    const statusMap = {
        'pending': 'Order Placed',
        'processing': 'Processing',
        'assigned': 'Assigned to Delivery',
        'picked_up': 'Picked Up',
        'in_transit': 'In Transit',
        'delivered': 'Delivered',
        'cancelled': 'Cancelled',
        'returned': 'Returned'
    };
    return statusMap[status] || status;
}

function getDeliveryProgress(status) {
    const progressMap = {
        'pending': 10,
        'processing': 25,
        'assigned': 40,
        'picked_up': 60,
        'in_transit': 80,
        'delivered': 100,
        'cancelled': 0,
        'returned': 0
    };
    return progressMap[status] || 0;
}

async function getDeliveryTracking(orderId) {
    try {
        const [tracking] = await pool.execute(`
            SELECT dt.*, dp.vehicle_type, dp.vehicle_number, u.name as delivery_person_name,
                   u.phone as delivery_person_phone
            FROM delivery_tracking dt
            LEFT JOIN delivery_personnel dp ON dt.delivery_id = dp.delivery_id
            LEFT JOIN users u ON dp.user_id = u.user_id
            WHERE dt.order_id = ?
            ORDER BY dt.timestamp DESC
        `, [orderId]);

        // Add formatted timestamps
        return tracking.map(entry => ({
            ...entry,
            timestamp_formatted: new Date(entry.timestamp).toLocaleString('en-US', {
                year: 'numeric',
                month: 'long',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
            })
        }));
    } catch (error) {
        console.error('Error getting delivery tracking:', error);
        return [];
    }
}

// Get delivery information for an order
async function getOrderDeliveryInfo(req, res) {
    try {
        const { order_id } = req.params;
        const user_id = req.user.id;
        const userRole = req.user.roleId;

        // Check if order exists and user has access
        const [orderResult] = await pool.execute(
            'SELECT * FROM orders WHERE order_id = ?',
            [order_id]
        );

        if (orderResult.length === 0) {
            return res.status(404).json({
                success: false,
                error: 'Order not found'
            });
        }

        const order = orderResult[0];

        // Check permissions
        if (userRole === 3 && order.customer_id !== user_id) {
            return res.status(403).json({
                success: false,
                error: 'Access denied'
            });
        }

        // Get delivery information
        const deliveryInfo = {
            order_id: order.order_id,
            status: order.status,
            delivery_status: getDeliveryStatus(order.status),
            delivery_progress: getDeliveryProgress(order.status),
            estimated_delivery_time: order.estimated_delivery_time,
            actual_delivery_time: order.actual_delivery_time
        };

        // Add delivery personnel info if assigned
        if (order.delivery_id) {
            const [deliveryPersonnel] = await pool.execute(`
                SELECT dp.*, u.name as delivery_person_name, u.phone as delivery_person_phone,
                       dz.name_en as delivery_zone_name
                FROM delivery_personnel dp
                JOIN users u ON dp.user_id = u.user_id
                LEFT JOIN delivery_zones dz ON dp.zone_id = dz.zone_id
                WHERE dp.delivery_id = ?
            `, [order.delivery_id]);

            if (deliveryPersonnel.length > 0) {
                deliveryInfo.delivery_personnel = deliveryPersonnel[0];
            }
        }

        // Add delivery tracking
        deliveryInfo.tracking = await getDeliveryTracking(order_id);

        // Add delivery address
        if (order.address_id) {
            const [addressResult] = await pool.execute(
                'SELECT * FROM delivery_addresses WHERE address_id = ?',
                [order.address_id]
            );
            if (addressResult.length > 0) {
                deliveryInfo.delivery_address = addressResult[0];
            }
        }

        res.json({
            success: true,
            data: deliveryInfo,
            message: 'Delivery information retrieved successfully'
        });

    } catch (error) {
        console.error('Error getting order delivery info:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to get delivery information',
            details: error.message
        });
    }
}

async function createOrder(req, res) {
    try {
        const customer_id = req.user.id;
        const userRole = req.user.roleId;
        const validPaymentMethods = ['cash', 'card', 'transfer']; // Moved up

        const { delivery_address_id, delivery_zone_id, delivery_fee, payment_method, coupon_code, cart_items } = req.body;

        // Only customers can create orders
        if (![2, 3].includes(userRole)) {
            console.error('Order creation failed: Only customers or vendors can create orders');
            return res.status(403).json({ error: 'Only customers or vendors can create orders' });
        }

        // Validate payment method
        if (!validPaymentMethods.includes(payment_method)) {
            return res.status(400).json({ error: 'Invalid payment method' });
        }





        // Use cart items from request body or fetch from database
        let cart;
        if (cart_items && Array.isArray(cart_items) && cart_items.length > 0) {
            const validItems = cart_items.filter(item => {
                if (!item.product_id || !item.quantity || !item.product_price) {
                    console.error('Invalid cart item:', item);
                    return false;
                }
                return true;
            });

            if (validItems.length === 0) {
                console.error('No valid cart items found');
                return res.status(400).json({ error: 'Invalid cart items. Missing required fields.' });
            }

            cart = {
                items: validItems,
                total: validItems.reduce((sum, item) => {
                    const price = typeof item.product_price === 'number' ? item.product_price : Number(item.product_price);
                    return sum + (price * item.quantity);
                }, 0),
            };
        } else {
            cart = await Cart.findByCustomerId(customer_id);
        }

        if (!cart || !cart.items || cart.items.length === 0) {
            console.error('Order creation failed: Cart is empty or not found');
            return res.status(400).json({ error: 'Your cart is empty. Please add items before checking out.' });
        }

        // Check if cart total is valid
        if (!cart.total || cart.total <= 0) {
            console.error('Order creation failed: Cart total is invalid:', cart.total);
            return res.status(400).json({ error: 'Invalid cart total. Please check your cart items.' });
        }

        // Calculate total
        let total = cart.total;
        let discount = 0;
        let coupon_id = null;

        if (coupon_code) {
            const [couponRows] = await pool.query('SELECT * FROM coupons WHERE code = ?', [coupon_code]);
            if (couponRows.length > 0) {
                const coupon = couponRows[0];
                coupon_id = coupon.coupon_id;
                if (coupon.discount_percentage) {
                    discount = (total * coupon.discount_percentage) / 100;
                } else if (coupon.discount_amount) {
                    discount = coupon.discount_amount;
                }
                total = total - discount;
            }
        }
        const deliveryFeeNum = parseFloat(delivery_fee) || 0;

        // Add delivery fee to total if provided
        if (deliveryFeeNum && deliveryFeeNum > 0) {
            total = total + deliveryFeeNum;
        }

        if (!customer_id || !total) {
            console.error('Order creation failed: Customer ID and total are required');
            return res.status(400).json({ error: 'Order creation failed: Customer ID and total are required.' });
        }

        // Group items by vendor_id
        const itemsByVendor = {};
        for (const item of cart.items) {
            let vendor_id = item.vendor_id;
            if (!vendor_id) {
                const [productRows] = await pool.query('SELECT vendor_id FROM products WHERE product_id = ?', [item.product_id]);
                if (productRows.length > 0) {
                    vendor_id = productRows[0].vendor_id;
                } else {
                    console.error(`Product ${item.product_id} not found`);
                    continue;
                }
            }

            if (!vendor_id) {
                console.error(`No vendor_id found for product ${item.product_id}`);
                continue;
            }

            if (!itemsByVendor[vendor_id]) itemsByVendor[vendor_id] = [];
            itemsByVendor[vendor_id].push({ ...item, vendor_id });
        }

        if (Object.keys(itemsByVendor).length === 0) {
            console.error('Order creation failed: No valid items found');
            return res.status(400).json({ error: 'No valid items found in cart.' });
        }

        const split_group_id = require('crypto').randomUUID();
        const createdOrders = [];

        for (const [vendor_id, items] of Object.entries(itemsByVendor)) {
            let vendorTotal = items.reduce((sum, item) => {
                const price = item.final_price || item.product_price;
                return sum + (price * item.quantity);
            }, 0);

            if (discount > 0) {
                const proportion = vendorTotal / cart.total;
                vendorTotal -= (discount * proportion);
            }

            if (deliveryFeeNum && deliveryFeeNum > 0) {
                vendorTotal += deliveryFeeNum;
            }

            const result = await Order.create({
                customer_id,
                vendor_id: Number(vendor_id),
                total: vendorTotal,
                address_id: delivery_address_id,
                delivery_zone_id,
                deliveryFeeNum,
                payment_method,
                split_group_id,
                confirmation_status: 'pending',
                coupon_id,
            });
            const order_id = result.order_id;

            for (const item of items) {
                const price = item.final_price || item.product_price;
                await pool.query(
                    'INSERT INTO order_items (order_id, product_id, qty, price, total_price) VALUES (?, ?, ?, ?, ?)',
                    [order_id, item.product_id, item.quantity, price, price * item.quantity]
                );

                await pool.query(
                    'UPDATE products SET stock = stock - ? WHERE product_id = ?',
                    [item.quantity, item.product_id]
                );
            }

            let orderStatus = 'pending';
            let paymentStatus = 'pending';
            if (payment_method === 'cash') {
                paymentStatus = 'pending_cod';
            }
            await Order.updateStatus(order_id, orderStatus);

            try {
                const DatabaseProceduresController = require('./DatabaseProceduresController');
                await DatabaseProceduresController.calculateVendorCommission(order_id, Number(vendor_id), vendorTotal);
            } catch (commissionError) {
                console.error(`Error calculating commission for vendor ${vendor_id}:`, commissionError);
            }

            createdOrders.push({
                order_id,
                vendor_id: Number(vendor_id),
                total: vendorTotal,
                order_status: orderStatus,
                payment_status: paymentStatus,
            });
        }

        res.status(201).json({
            message: 'Orders created successfully',
            split_group_id,
            orders: createdOrders,
        });
    } catch (err) {
        console.error('Order creation failed (catch):', err);
        res.status(500).json({ error: 'Error creating order: ' + err.message });
    }
}

async function updateOrderStatus(req, res) {
    try {
        const { id } = req.params;
        const { status } = req.body;
        const userRole = req.user.roleId;

        // Only admins and vendors can update order status
        if (userRole === 3) {
            return res.status(403).json({ error: 'Customers cannot update order status' });
        }

        // Get current order status
        const currentOrder = await Order.findById(id);
        if (!currentOrder) {
            return res.status(404).json({ error: 'Order not found' });
        }

        const oldStatus = currentOrder.status;
        const result = await Order.updateStatus(id, status);

        // Send notifications if status actually changed
        if (oldStatus !== status) {
            try {
                // Send notification to customer
                await enhancedNotificationService.sendOrderStatusChangeNotification(id, status, currentOrder.customer_id);

                // Send notification to vendor
                await enhancedNotificationService.sendVendorOrderStatusNotification(id, status);

                // Send notification to delivery personnel if assigned
                if (currentOrder.delivery_id) {
                    await enhancedNotificationService.sendDeliveryOrderStatusNotification(id, status);
                }

            } catch (notificationError) {
                console.error(`❌ [updateOrderStatus] Error sending notifications for order ${id}:`, notificationError);
                // Don't fail the request if notifications fail
            }
        }

        res.json({
            message: result.message,
            statusChanged: oldStatus !== status,
            oldStatus,
            newStatus: status
        });
    } catch (error) {
        console.error('Error updating order status:', error);
        res.status(500).json({ error: 'Server Error', details: error.message });
    }
}

async function updateOrderDetails(req, res) {
    try {
        const { id } = req.params;
        const {
            customer_name,
            customer_phone,
            delivery_address,
            address_id,
            delivery_zone_id,
            notes
        } = req.body;

        console.log('🔍 [DEBUG] updateOrderDetails called with:', {
            order_id: id,
            customer_name,
            customer_phone,
            delivery_address,
            address_id,
            delivery_zone_id,
            notes,
            user_id: req.user.id,
            user_role: req.user.roleId
        });

        // Get order details
        const [orders] = await pool.execute(`
            SELECT o.*, u.name as customer_name, u.phone as customer_phone, da.address as delivery_address
            FROM orders o
            JOIN users u ON o.customer_id = u.user_id
            LEFT JOIN delivery_addresses da ON o.address_id = da.address_id
            WHERE o.order_id = ?
        `, [id]);

        if (orders.length > 0) {
            console.log('🔍 [DEBUG] Order details:', {
                order_id: orders[0].order_id,
                customer_id: orders[0].customer_id,
                address_id: orders[0].address_id,
                status: orders[0].status
            });
        }

        if (orders.length === 0) {
            return res.status(404).json({ error: 'Order not found' });
        }

        const order = orders[0];

        // Start transaction
        const connection = await pool.getConnection();
        await connection.beginTransaction();

        try {
            // Update customer information if provided
            if (customer_name || customer_phone) {
                const updateUserFields = [];
                const updateUserValues = [];

                if (customer_name) {
                    updateUserFields.push('name = ?');
                    updateUserValues.push(customer_name);
                }
                if (customer_phone) {
                    updateUserFields.push('phone = ?');
                    updateUserValues.push(customer_phone);
                }

                if (updateUserFields.length > 0) {
                    updateUserValues.push(order.customer_id);
                    console.log('🔍 [DEBUG] Executing user update query:', {
                        fields: updateUserFields.join(', '),
                        values: updateUserValues,
                        customer_id: order.customer_id
                    });
                    await connection.execute(`
                        UPDATE users 
                        SET ${updateUserFields.join(', ')}, updated_at = NOW()
                        WHERE user_id = ?
                    `, updateUserValues);
                }
            }

            // Update delivery address if provided
            if (delivery_address) {
                if (address_id) {
                    // Update existing address with provided address_id
                    await connection.execute(`
                        UPDATE delivery_addresses 
                        SET address = ?
                        WHERE address_id = ?
                    `, [delivery_address, address_id]);
                } else {
                    // Create new address if no address_id provided
                    const [result] = await connection.execute(`
                        INSERT INTO delivery_addresses (customer_id, address, created_at)
                        VALUES (?, ?, NOW())
                    `, [order.customer_id, delivery_address]);

                    // Update order with new address_id
                    await connection.execute(`
                        UPDATE orders 
                        SET address_id = ?
                        WHERE order_id = ?
                    `, [result.insertId, id]);
                }
            }

            // Update order fields if provided
            const updateOrderFields = [];
            const updateOrderValues = [];

            if (delivery_zone_id) {
                updateOrderFields.push('delivery_zone_id = ?');
                updateOrderValues.push(delivery_zone_id);
            }
            if (notes !== undefined) {
                updateOrderFields.push('delivery_notes = ?');
                updateOrderValues.push(notes);
            }

            console.log('🔍 [DEBUG] Order fields to update:', {
                delivery_zone_id,
                notes,
                updateOrderFields,
                updateOrderValues
            });

            if (updateOrderFields.length > 0) {
                updateOrderValues.push(id);
                console.log('🔍 [DEBUG] Executing order update query:', {
                    fields: updateOrderFields.join(', '),
                    values: updateOrderValues,
                    order_id: id
                });
                await connection.execute(`
                    UPDATE orders 
                    SET ${updateOrderFields.join(', ')}
                    WHERE order_id = ?
                `, updateOrderValues);
            }

            // Commit transaction
            await connection.commit();
            // Create notification for customer


            res.json({
                message: 'Order details updated successfully',
                order_id: id
            });

        } catch (error) {
            // Rollback transaction on error
            await connection.rollback();
            throw error;
        } finally {
            connection.release();
        }

    } catch (error) {
        console.error('❌ [DEBUG] Error updating order details:', error);
        console.error('❌ [DEBUG] Error stack:', error.stack);
        res.status(500).json({ error: 'Failed to update order details', details: error.message });
    }
}

async function cancelOrder(req, res) {
    try {
        const { id } = req.params;
        const user_id = req.user.id;
        const userRole = req.user.roleId;

        // Only customers can cancel their own orders, or admins can cancel any order
        const order = await Order.findById(id);
        if (!order) {
            return res.status(404).json({ error: 'Order not found' });
        }

        // Check if user is customer (role 2) and order belongs to them
        if (userRole === 2 && order.customer_id !== user_id) {
            return res.status(403).json({ error: 'You can only cancel your own orders' });
        }

        // Check if user has permission to cancel orders
        if (userRole !== 2 && userRole !== 1) {
            return res.status(403).json({ error: 'Only customers or admins can cancel orders' });
        }

        if (order.status === 'delivered') {
            return res.status(400).json({ error: 'Cannot cancel delivered order' });
        }

        const result = await Order.cancel(id);
        // Send cancellation notifications
        try {
            await enhancedNotificationService.sendOrderStatusChangeNotification(id, 'cancelled', order.customer_id);
            await enhancedNotificationService.sendVendorOrderStatusNotification(id, 'cancelled');
            if (order.delivery_id) {
                await enhancedNotificationService.sendDeliveryOrderStatusNotification(id, 'cancelled');
            }
        } catch (notificationError) {
            console.error(`❌ [cancelOrder] Error sending cancellation notifications for order ${id}:`, notificationError);
        }

        res.json(result);
    } catch (error) {
        console.error('[DEBUG] Error in cancelOrder:', error);
        res.status(500).json({ error: 'Server Error', details: error.message });
    }
}

// Vendor confirms an order
async function confirmOrder(req, res) {
    try {
        const { id } = req.params;
        const user_id = req.user.id;
        const userRole = req.user.roleId;
        // Only vendors can confirm their own orders
        if (userRole !== 3) {
            return res.status(403).json({ error: 'Only vendors can confirm orders' });
        }
        const order = await Order.findById(id);
        if (!order) {
            return res.status(404).json({ error: 'Order not found' });
        }
        if (order.vendor_id !== user_id) {
            return res.status(403).json({ error: 'You can only confirm your own orders' });
        }
        if (order.confirmation_status !== 'pending') {
            return res.status(400).json({ error: 'Order is not pending confirmation' });
        }
        await pool.execute('UPDATE orders SET confirmation_status = ?, confirmed_at = NOW(), status = ? WHERE order_id = ?', ['confirmed', 'processing', id]);

        // Send confirmation notifications
        try {
            await enhancedNotificationService.sendOrderStatusChangeNotification(id, 'processing', order.customer_id);
        } catch (notificationError) {
            console.error(`❌ [confirmOrder] Error sending confirmation notifications for order ${id}:`, notificationError);
        }

        res.json({ message: 'Order confirmed' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Server Error', details: error.message });
    }
}

// Vendor rejects an order
async function rejectOrder(req, res) {
    try {
        const { id } = req.params;
        const user_id = req.user.id;
        const userRole = req.user.roleId;
        // Only vendors can reject their own orders
        if (userRole !== 3) {
            return res.status(403).json({ error: 'Only vendors can reject orders' });
        }
        const order = await Order.findById(id);
        if (!order) {
            return res.status(404).json({ error: 'Order not found' });
        }
        if (order.vendor_id !== user_id) {
            return res.status(403).json({ error: 'You can only reject your own orders' });
        }
        if (order.confirmation_status !== 'pending') {
            return res.status(400).json({ error: 'Order is not pending confirmation' });
        }
        await pool.execute('UPDATE orders SET confirmation_status = ?, confirmed_at = NOW(), status = ? WHERE order_id = ?', ['rejected', 'cancelled', id]);
        res.json({ message: 'Order rejected and cancelled' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Server Error', details: error.message });
    }
}

// Assign delivery to a confirmed order
async function assignDelivery(req, res) {
    try {
        const { order_id, delivery_id, estimated_pickup_time, notes } = req.body;
        const assigned_by = req.user.id;

        // Only admin or support can assign delivery
        if (![1, 7].includes(req.user.role)) {
            return res.status(403).json({ error: 'Only admin or support can assign delivery' });
        }

        // Validate required fields
        if (!order_id || !delivery_id) {
            return res.status(400).json({ error: 'Order ID and Delivery ID are required' });
        }

        // Call stored procedure to assign delivery
        await pool.execute('CALL AssignDeliveryToOrder(?, ?, ?)', [order_id, delivery_id, assigned_by]);

        res.json({
            success: true,
            message: 'Delivery assigned successfully'
        });
    } catch (error) {
        console.error('Error assigning delivery:', error);
        res.status(500).json({ error: 'Failed to assign delivery' });
    }
}

// Vendor assign delivery to order (vendor can only assign to delivery personnel in same zone)
async function vendorAssignDelivery(req, res) {
    try {
        const { order_id, delivery_id, estimated_pickup_time, notes } = req.body;
        const vendor_id = req.user.id;

        // Only vendors can use this endpoint
        const userRole = req.user.roleId || req.user.role || req.user.role_id;
        if (![3, 4, 5].includes(userRole)) {
            return res.status(403).json({ error: 'Only vendors can assign delivery' });
        }

        // Validate required fields
        if (!order_id || !delivery_id) {
            return res.status(400).json({ error: 'Order ID and Delivery ID are required' });
        }

        // Check if order belongs to this vendor
        const [orderResult] = await pool.execute(`
            SELECT o.*
            FROM orders o 
            WHERE o.order_id = ? AND o.vendor_id = ?
        `, [order_id, vendor_id]);

        if (orderResult.length === 0) {
            return res.status(404).json({ error: 'Order not found or does not belong to this vendor' });
        }

        const order = orderResult[0];

        // Check if order is in a status that allows delivery assignment
        if (!['processing', 'pending'].includes(order.status)) {
            return res.status(400).json({ error: 'Order is not in a status that allows delivery assignment' });
        }

        // Get delivery personnel details and check zone compatibility
        const [deliveryResult] = await pool.execute(`
            SELECT dp.*, u.name as delivery_person_name, u.phone as delivery_person_phone
            FROM delivery_personnel dp
            JOIN users u ON dp.user_id = u.user_id
            WHERE dp.delivery_id = ? AND dp.is_available = 1 AND dp.is_verified = 1
        `, [delivery_id]);

        if (deliveryResult.length === 0) {
            return res.status(400).json({ error: 'Delivery personnel not available or not verified' });
        }

        const deliveryPerson = deliveryResult[0];

        // Check if delivery personnel is in the same zone as the order
        if (order.delivery_zone_id && deliveryPerson.zone_id && order.delivery_zone_id !== deliveryPerson.zone_id) {
            return res.status(400).json({
                error: 'Delivery personnel must be in the same zone as the order',
                orderZone: order.delivery_zone_id,
                deliveryZone: deliveryPerson.zone_id
            });
        }

        // Check if order is already assigned
        const [existingAssignment] = await pool.execute(
            'SELECT * FROM delivery_assignments WHERE order_id = ?',
            [order_id]
        );
        if (existingAssignment.length > 0) {
            return res.status(400).json({ error: 'Order is already assigned to delivery personnel' });
        }

        // Begin transaction
        await pool.execute('START TRANSACTION');

        try {
            // Create delivery assignment
            await pool.execute(
                'INSERT INTO delivery_assignments (order_id, delivery_id, assigned_by, notes) VALUES (?, ?, ?, ?)',
                [order_id, delivery_id, vendor_id, notes || null]
            );

            // Update order status and delivery info
            const estimatedDeliveryTime = estimated_pickup_time ?
                new Date(estimated_pickup_time).getTime() + (24 * 60 * 60 * 1000) : // 24 hours from pickup
                new Date().getTime() + (24 * 60 * 60 * 1000);

            await pool.execute(
                'UPDATE orders SET status = "assigned", delivery_id = ?, estimated_delivery_time = ? WHERE order_id = ?',
                [delivery_id, new Date(estimatedDeliveryTime), order_id]
            );

            // Create delivery tracking entry
            await pool.execute(
                'INSERT INTO delivery_tracking (order_id, delivery_id, status, notes) VALUES (?, ?, "assigned", ?)',
                [order_id, delivery_id, notes || `Order assigned to delivery personnel by vendor. Estimated pickup: ${estimated_pickup_time || 'ASAP'}`]
            );

            await pool.execute('COMMIT');

            // Get assignment details for response
            const [assignmentResult] = await pool.execute(`
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
            await pool.execute('ROLLBACK');
            throw error;
        }
    } catch (error) {
        console.error('Error assigning delivery:', error);
        res.status(500).json({ error: 'Failed to assign delivery' });
    }
}

// Get available delivery personnel for vendor's orders (same zone)
async function getAvailableDeliveryForVendor(req, res) {
    try {
        const vendor_id = req.user.id;
        const { order_id } = req.params;

        // Only vendors can use this endpoint
        const userRole = req.user.roleId || req.user.role || req.user.role_id;
        if (![3, 4, 5].includes(userRole)) {
            return res.status(403).json({ error: 'Only vendors can access this endpoint' });
        }

        // Check vendor has access to this order
        const hasVendor = await Order.hasVendorInOrder(order_id, vendor_id);
        if (!hasVendor) {
            return res.status(403).json({ error: 'Order not found or does not belong to this vendor' });
        }

        // Get order details and zone
        const [orderResult] = await pool.execute(
            `SELECT o.*, dz.name_en as zone_name
            FROM orders o 
            LEFT JOIN delivery_addresses da ON o.address_id = da.address_id
            LEFT JOIN delivery_zones dz ON o.delivery_zone_id = dz.zone_id
            WHERE o.order_id = ?`,
            [order_id]
        );

        if (orderResult.length === 0) {
            return res.status(404).json({ error: 'Order not found' });
        }

        const order = orderResult[0];

        // Get available delivery personnel in the same zone
        let query, params;
        if (order.delivery_zone_id) {
            query = `
                SELECT dp.delivery_id, u.name, u.phone, dp.vehicle_type, dp.vehicle_number, 
                       dp.rating, dp.total_deliveries, dz.name_en as zone_name
                FROM delivery_personnel dp
                JOIN users u ON dp.user_id = u.user_id
                JOIN delivery_zones dz ON dp.zone_id = dz.zone_id
                WHERE dp.zone_id = ? AND dp.is_available = 1 AND dp.is_verified = 1
                ORDER BY dp.rating DESC, dp.total_deliveries DESC
            `;
            params = [order.delivery_zone_id];
        } else {
            // If no specific zone, get all available delivery personnel
            query = `
                SELECT dp.delivery_id, u.name, u.phone, dp.vehicle_type, dp.vehicle_number, 
                       dp.rating, dp.total_deliveries, COALESCE(dz.name_en, 'No Zone') as zone_name
                FROM delivery_personnel dp
                JOIN users u ON dp.user_id = u.user_id
                LEFT JOIN delivery_zones dz ON dp.zone_id = dz.zone_id
                WHERE dp.is_available = 1 AND dp.is_verified = 1
                ORDER BY dp.rating DESC, dp.total_deliveries DESC
            `;
            params = [];
        }

        const [deliveryPersonnel] = await pool.query(query, params);

        res.json({
            success: true,
            data: {
                order: {
                    order_id: order.order_id,
                    zone_id: order.delivery_zone_id,
                    zone_name: order.zone_name
                },
                available_delivery: deliveryPersonnel
            },
            message: 'Available delivery personnel retrieved successfully'
        });
    } catch (error) {
        console.error('Error getting available delivery personnel:', error);
        res.status(500).json({ error: 'Failed to get available delivery personnel' });
    }
}

// Vendor-specific order status update
async function vendorUpdateOrderStatus(req, res) {
    try {
        const { order_id, status } = req.body;
        const vendor_id = req.user.id;
        const userRole = req.user.roleId;
        if (![3, 4, 5].includes(userRole)) {
            return res.status(403).json({ error: 'Only vendors can update order status' });
        }
        // Check vendor has access to this order
        const hasVendor = await Order.hasVendorInOrder(order_id, vendor_id);
        if (!hasVendor) {
            return res.status(403).json({ error: 'Access denied: This order does not contain your products' });
        }
        // Restrict vendors to only change from pending to processing
        const allowedStatuses = ['processing'];
        if (!allowedStatuses.includes(status)) {
            return res.status(400).json({ error: 'Vendors can only change order status to processing' });
        }

        // Check if current order status is pending
        const currentOrder = await Order.findById(order_id);
        if (!currentOrder) {
            return res.status(404).json({ error: 'Order not found' });
        }

        if (currentOrder.status !== 'pending') {
            return res.status(400).json({ error: 'Vendors can only change orders from pending to processing status' });
        }
        const result = await Order.updateStatus(order_id, status);
        res.json({ success: true, message: result.message });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Server Error', details: error.message });
    }
}

// Vendor bulk status update
async function vendorBulkUpdateOrderStatus(req, res) {
    try {
        const { order_ids, status } = req.body;
        const vendor_id = req.user.id;
        const userRole = req.user.roleId;
        if (![3, 4, 5].includes(userRole)) {
            return res.status(403).json({ error: 'Only vendors can update order status' });
        }
        if (!Array.isArray(order_ids) || order_ids.length === 0) {
            return res.status(400).json({ error: 'order_ids must be a non-empty array' });
        }
        const allowedStatuses = ['processing'];
        if (!allowedStatuses.includes(status)) {
            return res.status(400).json({ error: 'Vendors can only change order status to processing' });
        }
        let updated = 0, denied = 0, invalidStatus = 0;
        for (const order_id of order_ids) {
            const hasVendor = await Order.hasVendorInOrder(order_id, vendor_id);
            if (hasVendor) {
                // Check if current order status is pending
                const currentOrder = await Order.findById(order_id);
                if (currentOrder && currentOrder.status === 'pending') {
                    await Order.updateStatus(order_id, status);
                    updated++;
                } else {
                    invalidStatus++;
                }
            } else {
                denied++;
            }
        }
        res.json({
            success: true,
            updated,
            denied,
            invalidStatus,
            message: `Updated ${updated} orders, denied ${denied} orders, ${invalidStatus} orders had invalid status (must be pending)`
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Server Error', details: error.message });
    }
}

// Export orders to Excel
async function exportOrdersToExcel(req, res) {
    try {
        const userRole = req.user.roleId;
        let orders;

        // Different access based on user role
        if (userRole === 2) { // Customer - only their own orders
            orders = await Order.findByCustomer(req.user.id);
        } else if (userRole === 3 || userRole === 4 || userRole === 5) { // Vendor - orders for their products
            const vendorResult = await Order.findByVendor(req.user.id, { limit: 0, offset: 0, search: '' });
            orders = vendorResult.orders;
        } else { // Admin - all orders
            const result = await Order.findAllWithPaginationAndSearch({ limit: 0, offset: 0, search: '' });
            orders = result.orders;
        }

        // Create Excel workbook using xlsx library
        const XLSX = require('xlsx');

        // Prepare data for Excel
        const excelData = [];

        // Add header row
        excelData.push([
            'Order ID',
            'Customer Name',
            'Customer Phone',
            'Order Date',
            'Status',
            'Total Amount',
            'Payment Method',
            'Delivery Address',
            'Estimated Delivery',
            'Actual Delivery',
            'Items Count',
            'Notes'
        ]);

        // Add data rows
        for (const order of orders) {
            const orderData = typeof order.toJSON === 'function' ? order.toJSON() : order;

            excelData.push([
                orderData.order_id,
                orderData.customer_name || 'N/A',
                orderData.customer_phone || 'N/A',
                orderData.created_at ? new Date(orderData.created_at).toLocaleDateString() : 'N/A',
                orderData.status || 'N/A',
                orderData.total_amount ? `$${parseFloat(orderData.total_amount).toFixed(2)}` : 'N/A',
                orderData.payment_method || 'N/A',
                orderData.delivery_address || 'N/A',
                orderData.estimated_delivery_time ? new Date(orderData.estimated_delivery_time).toLocaleDateString() : 'N/A',
                orderData.actual_delivery_time ? new Date(orderData.actual_delivery_time).toLocaleDateString() : 'N/A',
                orderData.items_count || 0,
                orderData.notes || 'N/A'
            ]);
        }

        // Create workbook and worksheet
        const workbook = XLSX.utils.book_new();
        const worksheet = XLSX.utils.aoa_to_sheet(excelData);

        // Add worksheet to workbook
        XLSX.utils.book_append_sheet(workbook, worksheet, 'Orders');

        // Generate buffer
        const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });

        // Set response headers
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', 'attachment; filename="orders_export.xlsx"');
        res.setHeader('Content-Length', buffer.length);

        // Send the file
        res.send(buffer);

    } catch (error) {
        console.error('Error exporting orders to Excel:', error);
        res.status(500).json({ error: 'Failed to export orders to Excel' });
    }
}

module.exports = {
    getOrders,
    getOrderById,
    createOrder,
    updateOrderStatus,
    updateOrderDetails,
    cancelOrder,
    getOrderDeliveryInfo,
    confirmOrder,
    rejectOrder,
    assignDelivery,
    vendorAssignDelivery,
    getAvailableDeliveryForVendor,
    vendorUpdateOrderStatus,
    vendorBulkUpdateOrderStatus,
    exportOrdersToExcel,

};