const express = require('express');
const router = express.Router();
const DeliveryController = require('../controllers/DeliveryController');
const { authenticateJWT, authorizeRoles } = require('../middleware/auth');
const { upload, compressDeliveryConfirmationImage } = require('../middleware/upload');

// Middleware to check if user is delivery personnel
const requireDeliveryPersonnel = (req, res, next) => {
    if (req.user.roleId !== 6) { // Delivery personnel role
        return res.status(403).json({
            success: false,
            error: 'Access denied. Delivery personnel only.'
        });
    }
    next();
};

// Middleware to check if user is admin or order manager
const requireAdmin = (req, res, next) => {
    if (req.user.roleId !== 1 && req.user.roleId !== 10 &&req.user.roleId !== 12) { // Admin or Order Manager role
        return res.status(403).json({
            success: false,
            error: 'Access denied. Admin or Order Manager only.'
        });
    }
    next();
};

// PUBLIC ROUTES (no authentication required)
// Get delivery zones (Public)
router.get('/zones', async (req, res) => {
    try {
        const { pool } = require('../db/db');
        const [zones] = await pool.execute(`
            SELECT zone_id, name_en, name_ar, description, delivery_fee, estimated_delivery_time
            FROM delivery_zones 
            WHERE is_active = 1
            ORDER BY delivery_fee ASC
        `);

        res.json({
            success: true,
            data: zones,
            message: 'Delivery zones retrieved successfully'
        });
    } catch (error) {
        console.error('Error getting delivery zones:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to get delivery zones',
            details: error.message
        });
    }
});

// Calculate delivery fee for an address (Public)
router.post('/calculate-fee', async (req, res) => {
    try {
        const { address, zone_id } = req.body;
        
        if (!address && !zone_id) {
            return res.status(400).json({
                success: false,
                error: 'Address or zone_id is required'
            });
        }

        const { pool } = require('../db/db');
        let query, params;

        if (zone_id) {
            query = 'SELECT * FROM delivery_zones WHERE zone_id = ? AND is_active = 1';
            params = [zone_id];
        } else {
            // Simple address-based zone detection (you can enhance this)
            query = `
                SELECT * FROM delivery_zones 
                WHERE is_active = 1 
                ORDER BY delivery_fee ASC 
                LIMIT 1
            `;
            params = [];
        }

        const [zones] = await pool.execute(query, params);

        if (zones.length === 0) {
            return res.status(404).json({
                success: false,
                error: 'No delivery zone found'
            });
        }

        const zone = zones[0];
        res.json({
            success: true,
            data: {
                zone_id: zone.zone_id,
                zone_name: zone.name_en,
                delivery_fee: zone.delivery_fee,
                estimated_delivery_time: zone.estimated_delivery_time,
                estimated_delivery_date: new Date(Date.now() + (zone.estimated_delivery_time * 60 * 60 * 1000)).toISOString()
            },
            message: 'Delivery fee calculated successfully'
        });

    } catch (error) {
        console.error('Error calculating delivery fee:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to calculate delivery fee',
            details: error.message
        });
    }
});

// Get delivery status options (Public)
router.get('/status-options', (req, res) => {
    const statusOptions = [
        { value: 'pending', label: 'Order Placed', description: 'Order has been placed and is waiting for processing' },
        { value: 'processing', label: 'Processing', description: 'Order is being prepared for delivery' },
        { value: 'assigned', label: 'Assigned to Delivery', description: 'Order has been assigned to a delivery personnel' },
        { value: 'picked_up', label: 'Picked Up', description: 'Order has been picked up by delivery personnel' },
        { value: 'in_transit', label: 'In Transit', description: 'Order is on its way to you' },
        { value: 'delivered', label: 'Delivered', description: 'Order has been successfully delivered' },
        { value: 'cancelled', label: 'Cancelled', description: 'Order has been cancelled' },
        { value: 'returned', label: 'Returned', description: 'Order has been returned' }
    ];

    res.json({
        success: true,
        data: statusOptions,
        message: 'Delivery status options retrieved successfully'
    });
});

// Get delivery personnel by zone (Public)
router.get('/personnel/zone/:zone_id', async (req, res) => {
    try {
        const { zone_id } = req.params;
        const { pool } = require('../db/db');

        const [personnel] = await pool.execute(`
            SELECT dp.delivery_id, u.name, dp.vehicle_type, dp.vehicle_number, dp.rating, dp.total_deliveries
            FROM delivery_personnel dp
            JOIN users u ON dp.user_id = u.user_id
            WHERE dp.zone_id = ? AND dp.is_available = 1 AND dp.is_verified = 1
            ORDER BY dp.rating DESC, dp.total_deliveries DESC
        `, [zone_id]);

        res.json({
            success: true,
            data: personnel,
            message: 'Delivery personnel for zone retrieved successfully'
        });

    } catch (error) {
        console.error('Error getting delivery personnel by zone:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to get delivery personnel for zone',
            details: error.message
        });
    }
});

// PROTECTED ROUTES (authentication required)
// All delivery routes require authentication
router.use(authenticateJWT);

// Delivery Personnel Management (Admin and Order Manager)
router.get('/personnel/available', authorizeRoles([1, 10,12]), DeliveryController.getAvailableDeliveryPersonnel);
router.get("/personnel", authorizeRoles([1, 6,10,12]), async (req, res) => {
    try {
        const { pool } = require('../db/db');
        const [personnel] = await pool.execute(`
            SELECT 
                dp.delivery_id,
                u.name,
                u.email,
                u.phone,
                dp.zone_id,
                COALESCE(dz.name_en, '') as zone_name,
                dp.vehicle_type,
                dp.vehicle_number,
                dp.is_available,
                dp.rating,
                dp.total_deliveries,
                dp.is_verified
            FROM delivery_personnel dp
            JOIN users u ON dp.user_id = u.user_id
            LEFT JOIN delivery_zones dz ON dp.zone_id = dz.zone_id
            ORDER BY dp.created_at DESC
        `);

        res.json({
            success: true,
            data: personnel,
            message: 'All delivery personnel retrieved successfully'
        });
    } catch (error) {
        console.error('Error getting delivery personnel:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to get delivery personnel',
            details: error.message
        });
    }
});
router.get("/personnel/:id", DeliveryController.getDeliveryPersonnelById);
router.post("/personnel", authorizeRoles([1, 6,10,12]), DeliveryController.createDeliveryPersonnel);
router.put("/personnel/:id", authorizeRoles([1, 6,10, 12]), DeliveryController.updateDeliveryPersonnel);
router.delete("/personnel/:id", authorizeRoles([1, 6,10, 12]), DeliveryController.deleteDeliveryPersonnel);

// Order Assignment (Admin and Order Manager)
router.post("/orders/:orderId/assign/:deliveryId", authorizeRoles([1,10, 12]), DeliveryController.assignOrderToDelivery);

// Delivery Status Updates (Delivery Personnel and Admin)
// Note: Using the simpler route without orderId parameter

// Payment Confirmation (Delivery Personnel and Admin)
router.post("/orders/:orderId/confirm-payment", DeliveryController.confirmPayment);

// Get unassigned orders (Admin and Order Manager)
router.get('/orders/unassigned',  authorizeRoles([1,10, 12]), DeliveryController.getUnassignedOrders);

// Delivery Tracking (All authenticated users)
router.get("/orders/:order_id/tracking", DeliveryController.getDeliveryTracking);

// Available Delivery Personnel by Zone (Admin and Order Manager)
router.get("/zones/:zoneId/available", authorizeRoles([1, 10,12]), DeliveryController.getAvailableDeliveryPersonnel);

// Delivery Statistics (Delivery Personnel and Admin)
router.get("/personnel/:id/stats", DeliveryController.getDeliveryStats);

// Get all available delivery personnel (Admin and Order Manager)
// Note: This route is already defined above with requireAdmin middleware

// Assign order to delivery personnel (Admin and Order Manager)
router.post('/orders/assign', authorizeRoles([1, 10,12]), DeliveryController.assignOrderToDelivery);

// Get my assigned deliveries (Delivery Personnel)
router.get('/my-deliveries', requireDeliveryPersonnel, DeliveryController.getMyDeliveries);

// Update delivery status (Delivery Personnel)
router.put('/orders/status', requireDeliveryPersonnel, upload.single('delivery_confirmation_image'), compressDeliveryConfirmationImage, DeliveryController.updateDeliveryStatus);

// Update availability (Delivery Personnel)
router.put('/availability', requireDeliveryPersonnel, DeliveryController.updateAvailability);

// Get delivery statistics (Delivery Personnel)
router.get('/stats', requireDeliveryPersonnel, DeliveryController.getDeliveryStats);

// Get delivery earnings (Delivery Personnel)
router.get('/earnings', requireDeliveryPersonnel, async (req, res) => {
    try {
        const delivery_id = req.user.delivery_id;
        
        if (!delivery_id) {
            return res.status(400).json({
                success: false,
                error: 'Delivery ID not found. Please contact administrator.'
            });
        }

        const { period = 'all', page = 1, limit = 20 } = req.query;
        const offset = (parseInt(page) - 1) * parseInt(limit);

        let dateFilter = '';
        let params = [delivery_id];

        // Apply period filter
        switch (period) {
            case 'today':
                dateFilter = 'AND DATE(de.earned_at) = CURDATE()';
                break;
            case 'week':
                dateFilter = 'AND YEARWEEK(de.earned_at) = YEARWEEK(CURDATE())';
                break;
            case 'month':
                dateFilter = 'AND YEAR(de.earned_at) = YEAR(CURDATE()) AND MONTH(de.earned_at) = MONTH(CURDATE())';
                break;
            default:
                dateFilter = '';
        }

        // Get earnings records
        const [earningsResult] = await pool.execute(`
            SELECT 
                de.earnings_id,
                de.order_id,
                de.delivery_fee,
                de.earnings_amount,
                de.status,
                de.earned_at,
                de.notes,
                dz.name_en as zone_name,
                dz.name_ar as zone_name_ar,
                o.total as order_total,
                u.name as customer_name
            FROM delivery_earnings de
            JOIN delivery_zones dz ON de.zone_id = dz.zone_id
            JOIN orders o ON de.order_id = o.order_id
            JOIN users u ON o.customer_id = u.user_id
            WHERE de.delivery_id = ? ${dateFilter}
            ORDER BY de.earned_at DESC
            LIMIT ? OFFSET ?
        `, [...params, parseInt(limit), offset]);

        // Get total count for pagination
        const [countResult] = await pool.execute(`
            SELECT COUNT(*) as total
            FROM delivery_earnings de
            WHERE de.delivery_id = ? ${dateFilter}
        `, params);

        // Get earnings summary
        const [summaryResult] = await pool.execute(`
            SELECT 
                SUM(CASE WHEN de.status = 'completed' THEN de.earnings_amount ELSE 0 END) as total_earnings,
                SUM(CASE WHEN de.status = 'pending' THEN de.earnings_amount ELSE 0 END) as pending_earnings,
                COUNT(CASE WHEN de.status = 'completed' THEN 1 END) as completed_deliveries,
                COUNT(CASE WHEN de.status = 'pending' THEN 1 END) as pending_deliveries,
                AVG(de.earnings_amount) as avg_earnings_per_delivery
            FROM delivery_earnings de
            WHERE de.delivery_id = ? ${dateFilter}
        `, params);

        res.json({
            success: true,
            data: {
                earnings: earningsResult,
                summary: summaryResult[0] || {},
                pagination: {
                    total: countResult[0].total,
                    page: parseInt(page),
                    limit: parseInt(limit),
                    total_pages: Math.ceil(countResult[0].total / parseInt(limit))
                }
            },
            message: 'Delivery earnings retrieved successfully'
        });

    } catch (error) {
        console.error('Error getting delivery earnings:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to get delivery earnings',
            details: error.message
        });
    }
});

// Get delivery personnel earnings (Admin and Order Manager)
router.get('/personnel/:id/earnings', authorizeRoles([1, 10,12]), async (req, res) => {
    try {
        const { id } = req.params;
        const { pool } = require('../db/db');

        // Get earnings summary for the delivery personnel
        const [summaryResult] = await pool.execute(`
            SELECT 
                SUM(CASE WHEN DATE(de.earned_at) = CURDATE() THEN de.earnings_amount ELSE 0 END) as today_earnings,
                SUM(CASE WHEN YEARWEEK(de.earned_at) = YEARWEEK(CURDATE()) THEN de.earnings_amount ELSE 0 END) as this_week_earnings,
                SUM(CASE WHEN de.status = 'completed' THEN de.earnings_amount ELSE 0 END) as total_earnings,
                COUNT(CASE WHEN DATE(de.earned_at) = CURDATE() THEN 1 END) as today_deliveries,
                COUNT(CASE WHEN YEARWEEK(de.earned_at) = YEARWEEK(CURDATE()) THEN 1 END) as this_week_deliveries,
                COUNT(CASE WHEN de.status = 'completed' THEN 1 END) as total_deliveries
            FROM delivery_earnings de
            WHERE de.delivery_id = ?
        `, [id]);

        const summary = summaryResult[0] || {
            today_earnings: 0,
            this_week_earnings: 0,
            total_earnings: 0,
            today_deliveries: 0,
            this_week_deliveries: 0,
            total_deliveries: 0
        };

        res.json({
            success: true,
            data: {
                earnings: summary
            },
            message: 'Delivery personnel earnings retrieved successfully'
        });

    } catch (error) {
        console.error('Error getting delivery personnel earnings:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to get delivery personnel earnings',
            details: error.message
        });
    }
});

// Delivery Zones Management (Admin and Order Manager)
router.post('/zones', authorizeRoles([1, 10,12]), DeliveryController.createDeliveryZone);
router.put('/zones/:zoneId', authorizeRoles([1, 10,12]), DeliveryController.updateDeliveryZone);
router.delete('/zones/:zoneId', authorizeRoles([1, 10,12]), DeliveryController.deleteDeliveryZone);

// =====================================================
// DELIVERY CLAIM SYSTEM ROUTES
// =====================================================

// Debug endpoint
router.get('/debug', requireDeliveryPersonnel, DeliveryController.debugDatabaseState);

// Create test order (for debugging)
router.post('/create-test-order', requireDeliveryPersonnel, DeliveryController.createTestOrder);

// Get available orders for delivery personnel to claim
router.get('/available-orders', requireDeliveryPersonnel, DeliveryController.getAvailableOrdersForClaim);

// Claim an order for delivery
router.post('/orders/:order_id/claim', requireDeliveryPersonnel, DeliveryController.claimOrder);

// Cancel a claimed order
router.delete('/orders/:order_id/claim', requireDeliveryPersonnel, DeliveryController.cancelClaim);

// Get delivery personnel's claimed orders
router.get('/my-claimed-orders', requireDeliveryPersonnel, DeliveryController.getMyClaimedOrders);

// Check if delivery personnel can claim an order
router.get('/orders/:order_id/can-claim', requireDeliveryPersonnel, DeliveryController.checkCanClaimOrder);

// =====================================================
// END OF DELIVERY CLAIM SYSTEM ROUTES
// =====================================================

module.exports = router; 