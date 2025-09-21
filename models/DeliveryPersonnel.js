const { pool } = require('../db/db');
const db = pool;

class DeliveryPersonnel {
    constructor(data) {
        this.delivery_id = data.delivery_id;
        this.user_id = data.user_id;
        this.zone_id = data.zone_id;
        this.vehicle_type = data.vehicle_type;
        this.vehicle_number = data.vehicle_number;
        this.is_available = data.is_available;
        this.is_verified = data.is_verified;
        this.rating = data.rating;
        this.total_deliveries = data.total_deliveries;
        this.created_at = data.created_at;
        this.updated_at = data.updated_at;
    }

    // Create new delivery personnel
    static async create(deliveryData) {
        try {
            const [result] = await db.execute(`
                INSERT INTO delivery_personnel 
                (user_id, zone_id, vehicle_type, vehicle_number, is_available, is_verified, rating, total_deliveries)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            `, [
                deliveryData.user_id,
                deliveryData.zone_id,
                deliveryData.vehicle_type,
                deliveryData.vehicle_number,
                deliveryData.is_available || 1,
                deliveryData.is_verified || 0,
                deliveryData.rating || 0,
                deliveryData.total_deliveries || 0
            ]);

            return result.insertId;
        } catch (error) {
            console.error('Error creating delivery personnel:', error);
            throw error;
        }
    }

    // Find delivery personnel by ID
    static async findById(deliveryId) {
        try {
            const [rows] = await db.execute(`
                SELECT dp.*, u.name, u.email, u.phone, dz.name_en as zone_name
                FROM delivery_personnel dp
                JOIN users u ON dp.user_id = u.user_id
                LEFT JOIN delivery_zones dz ON dp.zone_id = dz.zone_id
                WHERE dp.delivery_id = ?
            `, [deliveryId]);

            return rows.length > 0 ? new DeliveryPersonnel(rows[0]) : null;
        } catch (error) {
            console.error('Error finding delivery personnel by ID:', error);
            throw error;
        }
    }

    // Find delivery personnel by user ID
    static async findByUserId(userId) {
        try {
            const [rows] = await db.execute(`
                SELECT dp.*, u.name, u.email, u.phone, dz.name_en as zone_name
                FROM delivery_personnel dp
                JOIN users u ON dp.user_id = u.user_id
                LEFT JOIN delivery_zones dz ON dp.zone_id = dz.zone_id
                WHERE dp.user_id = ?
            `, [userId]);

            return rows.length > 0 ? new DeliveryPersonnel(rows[0]) : null;
        } catch (error) {
            console.error('Error finding delivery personnel by user ID:', error);
            throw error;
        }
    }

    // Get all available delivery personnel
    static async getAvailable() {
        try {
            const [rows] = await db.execute(`
                SELECT dp.*, u.name, u.email, u.phone, dz.name_en as zone_name
                FROM delivery_personnel dp
                JOIN users u ON dp.user_id = u.user_id
                LEFT JOIN delivery_zones dz ON dp.zone_id = dz.zone_id
                WHERE dp.is_available = 1 AND dp.is_verified = 1
                ORDER BY dp.rating DESC, dp.total_deliveries ASC
            `);

            return rows.map(row => new DeliveryPersonnel(row));
        } catch (error) {
            console.error('Error getting available delivery personnel:', error);
            throw error;
        }
    }

    // Get delivery personnel by zone
    static async getByZone(zoneId) {
        try {
            const [rows] = await db.execute(`
                SELECT dp.*, u.name, u.email, u.phone, dz.name_en as zone_name
                FROM delivery_personnel dp
                JOIN users u ON dp.user_id = u.user_id
                LEFT JOIN delivery_zones dz ON dp.zone_id = dz.zone_id
                WHERE dp.zone_id = ? AND dp.is_available = 1 AND dp.is_verified = 1
                ORDER BY dp.rating DESC, dp.total_deliveries ASC
            `, [zoneId]);

            return rows.map(row => new DeliveryPersonnel(row));
        } catch (error) {
            console.error('Error getting delivery personnel by zone:', error);
            throw error;
        }
    }

    // Get all delivery personnel (for admin)
    static async getAll() {
        try {
            const [rows] = await db.execute(`
                SELECT dp.*, u.name, u.email, u.phone, dz.name_en as zone_name
                FROM delivery_personnel dp
                JOIN users u ON dp.user_id = u.user_id
                LEFT JOIN delivery_zones dz ON dp.zone_id = dz.zone_id
                ORDER BY dp.created_at DESC
            `);

            return rows.map(row => new DeliveryPersonnel(row));
        } catch (error) {
            console.error('Error getting all delivery personnel:', error);
            throw error;
        }
    }

    // Update delivery personnel
    async update(updateData) {
        try {
            const [result] = await db.execute(`
                UPDATE delivery_personnel 
                SET zone_id = ?, vehicle_type = ?, vehicle_number = ?, 
                    is_available = ?, is_verified = ?, rating = ?, total_deliveries = ?,
                    updated_at = NOW()
                WHERE delivery_id = ?
            `, [
                updateData.zone_id || this.zone_id,
                updateData.vehicle_type || this.vehicle_type,
                updateData.vehicle_number || this.vehicle_number,
                updateData.is_available !== undefined ? updateData.is_available : this.is_available,
                updateData.is_verified !== undefined ? updateData.is_verified : this.is_verified,
                updateData.rating || this.rating,
                updateData.total_deliveries || this.total_deliveries,
                this.delivery_id
            ]);

            return result.affectedRows > 0;
        } catch (error) {
            console.error('Error updating delivery personnel:', error);
            throw error;
        }
    }

    // Update availability
    async updateAvailability(isAvailable) {
        try {
            const [result] = await db.execute(`
                UPDATE delivery_personnel 
                SET is_available = ?, updated_at = NOW()
                WHERE delivery_id = ?
            `, [isAvailable ? 1 : 0, this.delivery_id]);

            if (result.affectedRows > 0) {
                this.is_available = isAvailable ? 1 : 0;
                this.updated_at = new Date();
            }

            return result.affectedRows > 0;
        } catch (error) {
            console.error('Error updating availability:', error);
            throw error;
        }
    }

    // Update rating
    async updateRating(newRating) {
        try {
            const [result] = await db.execute(`
                UPDATE delivery_personnel 
                SET rating = ?, updated_at = NOW()
                WHERE delivery_id = ?
            `, [newRating, this.delivery_id]);

            if (result.affectedRows > 0) {
                this.rating = newRating;
                this.updated_at = new Date();
            }

            return result.affectedRows > 0;
        } catch (error) {
            console.error('Error updating rating:', error);
            throw error;
        }
    }

    // Increment total deliveries
    async incrementDeliveries() {
        try {
            const [result] = await db.execute(`
                UPDATE delivery_personnel 
                SET total_deliveries = total_deliveries + 1, updated_at = NOW()
                WHERE delivery_id = ?
            `, [this.delivery_id]);

            if (result.affectedRows > 0) {
                this.total_deliveries += 1;
                this.updated_at = new Date();
            }

            return result.affectedRows > 0;
        } catch (error) {
            console.error('Error incrementing deliveries:', error);
            throw error;
        }
    }

    // Get delivery statistics
    async getStats() {
        try {
            const [stats] = await db.execute(`
                SELECT 
                    COUNT(*) as total_orders,
                    SUM(CASE WHEN status = 'delivered' THEN 1 ELSE 0 END) as completed_orders,
                    SUM(CASE WHEN status IN ('assigned', 'picked_up', 'in_transit') THEN 1 ELSE 0 END) as active_orders,
                    AVG(CASE WHEN status = 'delivered' THEN TIMESTAMPDIFF(MINUTE, placed_at, actual_delivery_time) END) as avg_delivery_time,
                    SUM(CASE WHEN status = 'delivered' THEN total_amount ELSE 0 END) as total_revenue
                FROM orders 
                WHERE delivery_id = ?
            `, [this.delivery_id]);

            return stats[0];
        } catch (error) {
            console.error('Error getting delivery statistics:', error);
            throw error;
        }
    }

    // Get recent deliveries
    async getRecentDeliveries(limit = 10) {
        try {
            const [deliveries] = await db.execute(`
                SELECT o.*, u.name as customer_name, da.address as delivery_address
                FROM orders o
                JOIN users u ON o.customer_id = u.user_id
                JOIN delivery_addresses da ON o.address_id = da.address_id
                WHERE o.delivery_id = ?
                ORDER BY o.placed_at DESC
                LIMIT ?
            `, [this.delivery_id, limit]);

            return deliveries;
        } catch (error) {
            console.error('Error getting recent deliveries:', error);
            throw error;
        }
    }

    // Delete delivery personnel
    async delete() {
        try {
            const [result] = await db.execute(`
                DELETE FROM delivery_personnel WHERE delivery_id = ?
            `, [this.delivery_id]);

            return result.affectedRows > 0;
        } catch (error) {
            console.error('Error deleting delivery personnel:', error);
            throw error;
        }
    }

    // Verify delivery personnel
    async verify() {
        try {
            const [result] = await db.execute(`
                UPDATE delivery_personnel 
                SET is_verified = 1, updated_at = NOW()
                WHERE delivery_id = ?
            `, [this.delivery_id]);

            if (result.affectedRows > 0) {
                this.is_verified = 1;
                this.updated_at = new Date();
            }

            return result.affectedRows > 0;
        } catch (error) {
            console.error('Error verifying delivery personnel:', error);
            throw error;
        }
    }

    // Get delivery personnel performance metrics
    static async getPerformanceMetrics() {
        try {
            const [metrics] = await db.execute(`
                SELECT 
                    dp.delivery_id,
                    u.name,
                    dp.rating,
                    dp.total_deliveries,
                    COUNT(o.order_id) as current_month_orders,
                    AVG(CASE WHEN o.status = 'delivered' THEN TIMESTAMPDIFF(MINUTE, o.placed_at, o.actual_delivery_time) END) as avg_delivery_time,
                    SUM(CASE WHEN o.status = 'delivered' THEN 1 ELSE 0 END) as completed_orders
                FROM delivery_personnel dp
                JOIN users u ON dp.user_id = u.user_id
                LEFT JOIN orders o ON dp.delivery_id = o.delivery_id 
                    AND MONTH(o.placed_at) = MONTH(CURRENT_DATE())
                    AND YEAR(o.placed_at) = YEAR(CURRENT_DATE())
                WHERE dp.is_verified = 1
                GROUP BY dp.delivery_id, u.name, dp.rating, dp.total_deliveries
                ORDER BY dp.rating DESC, completed_orders DESC
            `);

            return metrics;
        } catch (error) {
            console.error('Error getting performance metrics:', error);
            throw error;
        }
    }
}

module.exports = DeliveryPersonnel; 