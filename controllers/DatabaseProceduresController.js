const { pool } = require('../db/db');

// Controller for database procedures and functions
class DatabaseProceduresController {
    
    // Use the CalculateVendorCommission procedure instead of manual calculation
    static async calculateVendorCommission(orderId, vendorId, amount) {
        try {
            await pool.execute('CALL CalculateVendorCommission(?, ?, ?)', [orderId, vendorId, amount]);
            return { success: true, message: 'Commission calculated and stored' };
        } catch (error) {
            console.error('Error calling CalculateVendorCommission:', error);
            throw error;
        }
    }

    // Use the UpdateDeliveryStatus procedure
    static async updateDeliveryStatus(orderId, status, notes = null) {
        try {
            await pool.execute('CALL UpdateDeliveryStatus(?, ?, ?)', [orderId, status, notes]);
            return { success: true, message: 'Delivery status updated' };
        } catch (error) {
            console.error('Error calling UpdateDeliveryStatus:', error);
            throw error;
        }
    }

    // Use the CalculateOrderTotal function
    static async getOrderTotal(orderId) {
        try {
            const [rows] = await pool.execute('SELECT CalculateOrderTotal(?) as total', [orderId]);
            return rows[0].total;
        } catch (error) {
            console.error('Error calling CalculateOrderTotal:', error);
            throw error;
        }
    }

    // Use the GetDeliveryZoneFee function
    static async getDeliveryZoneFee(zoneId) {
        try {
            const [rows] = await pool.execute('SELECT GetDeliveryZoneFee(?) as fee', [zoneId]);
            return rows[0].fee;
        } catch (error) {
            console.error('Error calling GetDeliveryZoneFee:', error);
            throw error;
        }
    }

    // Use the GetVendorCommissionRate function
    static async getVendorCommissionRate(userId) {
        try {
            const [rows] = await pool.execute('SELECT GetVendorCommissionRate(?) as commission_rate', [userId]);
            return rows[0].commission_rate;
        } catch (error) {
            console.error('Error calling GetVendorCommissionRate:', error);
            throw error;
        }
    }

    // Use the IsActiveVendor function
    static async isActiveVendor(userId) {
        try {
            const [rows] = await pool.execute('SELECT IsActiveVendor(?) as is_active', [userId]);
            return rows[0].is_active === 1;
        } catch (error) {
            console.error('Error calling IsActiveVendor:', error);
            throw error;
        }
    }

    // Enhanced order creation with proper procedure usage
    static async createOrderWithProcedures(orderData) {
        try {
            // Start transaction
            await pool.execute('START TRANSACTION');

            // Create order logic here...
            // Then use the procedure for commission calculation
            if (orderData.vendor_id && orderData.total) {
                await this.calculateVendorCommission(
                    orderData.order_id, 
                    orderData.vendor_id, 
                    orderData.total
                );
            }

            await pool.execute('COMMIT');
            return { success: true, message: 'Order created with procedures' };
        } catch (error) {
            await pool.execute('ROLLBACK');
            console.error('Error in createOrderWithProcedures:', error);
            throw error;
        }
    }

    // Get delivery tracking with status updates
    static async getDeliveryTrackingWithStatus(orderId) {
        try {
            const [rows] = await pool.execute(`
                SELECT dt.*, dp.name as delivery_person_name, dp.phone as delivery_person_phone
                FROM delivery_tracking dt
                LEFT JOIN delivery_personnel dp ON dt.delivery_id = dp.delivery_id
                WHERE dt.order_id = ?
                ORDER BY dt.timestamp DESC
            `, [orderId]);
            
            return rows;
        } catch (error) {
            console.error('Error getting delivery tracking:', error);
            throw error;
        }
    }

    // Update delivery status with procedure
    static async updateDeliveryStatusWithProcedure(req, res) {
        try {
            const { order_id, status, notes } = req.body;
            const userRole = req.user.roleId;

            // Only delivery personnel and admins can update delivery status
            if (![1, 6].includes(userRole)) {
                return res.status(403).json({ error: 'Unauthorized to update delivery status' });
            }

            await this.updateDeliveryStatus(order_id, status, notes);
            
            res.json({ 
                message: 'Delivery status updated successfully',
                order_id,
                status,
                notes
            });
        } catch (error) {
            console.error('Error updating delivery status:', error);
            res.status(500).json({ error: 'Server Error', details: error.message });
        }
    }

    // Get order total using function
    static async getOrderTotalWithFunction(req, res) {
        try {
            const { order_id } = req.params;
            const total = await this.getOrderTotal(order_id);
            
            res.json({ 
                order_id,
                total: parseFloat(total)
            });
        } catch (error) {
            console.error('Error getting order total:', error);
            res.status(500).json({ error: 'Server Error', details: error.message });
        }
    }

    // Get vendor commission rate using function
    static async getVendorCommissionRateWithFunction(req, res) {
        try {
            const { user_id } = req.params;
            const commissionRate = await this.getVendorCommissionRate(user_id);
            
            res.json({ 
                user_id,
                commission_rate: parseFloat(commissionRate)
            });
        } catch (error) {
            console.error('Error getting vendor commission rate:', error);
            res.status(500).json({ error: 'Server Error', details: error.message });
        }
    }

    // Check if vendor is active using function
    static async checkVendorActiveStatus(req, res) {
        try {
            const { user_id } = req.params;
            const isActive = await this.isActiveVendor(user_id);
            
            res.json({ 
                user_id,
                is_active_vendor: isActive
            });
        } catch (error) {
            console.error('Error checking vendor status:', error);
            res.status(500).json({ error: 'Server Error', details: error.message });
        }
    }

    // Get delivery zone fee using function
    static async getDeliveryZoneFeeWithFunction(req, res) {
        try {
            const { zone_id } = req.params;
            const fee = await this.getDeliveryZoneFee(zone_id);
            
            res.json({ 
                zone_id,
                delivery_fee: parseFloat(fee)
            });
        } catch (error) {
            console.error('Error getting delivery zone fee:', error);
            res.status(500).json({ error: 'Server Error', details: error.message });
        }
    }
}

module.exports = {
    calculateVendorCommission: DatabaseProceduresController.calculateVendorCommission,
    updateDeliveryStatus: DatabaseProceduresController.updateDeliveryStatus,
    getOrderTotal: DatabaseProceduresController.getOrderTotal,
    getDeliveryZoneFee: DatabaseProceduresController.getDeliveryZoneFee,
    getVendorCommissionRate: DatabaseProceduresController.getVendorCommissionRate,
    isActiveVendor: DatabaseProceduresController.isActiveVendor,
    createOrderWithProcedures: DatabaseProceduresController.createOrderWithProcedures,
    getDeliveryTrackingWithStatus: DatabaseProceduresController.getDeliveryTrackingWithStatus,
    updateDeliveryStatusWithProcedure: DatabaseProceduresController.updateDeliveryStatusWithProcedure,
    getOrderTotalWithFunction: DatabaseProceduresController.getOrderTotalWithFunction,
    getVendorCommissionRateWithFunction: DatabaseProceduresController.getVendorCommissionRateWithFunction,
    checkVendorActiveStatus: DatabaseProceduresController.checkVendorActiveStatus,
    getDeliveryZoneFeeWithFunction: DatabaseProceduresController.getDeliveryZoneFeeWithFunction
}; 