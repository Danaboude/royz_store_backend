const { pool } = require('../db/db');

class DeliveryZone {
    constructor(data) {
        this.zone_id = data.zone_id;
        this.name_en = data.name_en;
        this.name_ar = data.name_ar;
        this.description = data.description;
        this.delivery_fee = data.delivery_fee;
        this.estimated_delivery_time = data.estimated_delivery_time;
        this.is_active = data.is_active;
        this.created_at = data.created_at;
    }

    static async findAll() {
        try {
            const [rows] = await pool.query(`
                SELECT * FROM delivery_zones 
                WHERE is_active = 1
                ORDER BY name_en ASC
            `);
            return rows;
        } catch (error) {
            throw new Error(`Error fetching delivery zones: ${error.message}`);
        }
    }

    static async findById(id) {
        try {
            const [rows] = await pool.query(`
                SELECT * FROM delivery_zones WHERE zone_id = ?
            `, [id]);
            return rows.length > 0 ? rows[0] : null;
        } catch (error) {
            throw new Error(`Error fetching delivery zone: ${error.message}`);
        }
    }

    static async create(zoneData) {
        try {
            const { 
                name_en, name_ar, description, delivery_fee, 
                estimated_delivery_time, is_active 
            } = zoneData;
            
            if (!name_en || !name_ar) {
                throw new Error('Zone names are required');
            }

            const [result] = await pool.query(
                'INSERT INTO delivery_zones (name_en, name_ar, description, delivery_fee, estimated_delivery_time, is_active) VALUES (?, ?, ?, ?, ?, ?)',
                [name_en, name_ar, description, delivery_fee || 0.00, estimated_delivery_time || 24, is_active !== undefined ? is_active : 1]
            );
            
            return { zone_id: result.insertId, message: 'Delivery zone created successfully' };
        } catch (error) {
            throw new Error(`Error creating delivery zone: ${error.message}`);
        }
    }

    static async update(id, updateData) {
        try {
            const { 
                name_en, name_ar, description, delivery_fee, 
                estimated_delivery_time, is_active 
            } = updateData;
            
            let updateFields = [];
            let params = [];

            if (name_en) {
                updateFields.push('name_en = ?');
                params.push(name_en);
            }
            if (name_ar) {
                updateFields.push('name_ar = ?');
                params.push(name_ar);
            }
            if (description !== undefined) {
                updateFields.push('description = ?');
                params.push(description);
            }
            if (delivery_fee !== undefined) {
                updateFields.push('delivery_fee = ?');
                params.push(delivery_fee);
            }
            if (estimated_delivery_time !== undefined) {
                updateFields.push('estimated_delivery_time = ?');
                params.push(estimated_delivery_time);
            }
            if (is_active !== undefined) {
                updateFields.push('is_active = ?');
                params.push(is_active);
            }

            if (updateFields.length === 0) {
                throw new Error('No fields to update');
            }

            params.push(id);

            const [result] = await pool.query(
                `UPDATE delivery_zones SET ${updateFields.join(', ')} WHERE zone_id = ?`,
                params
            );

            if (result.affectedRows === 0) {
                throw new Error('Delivery zone not found');
            }

            return { message: 'Delivery zone updated successfully' };
        } catch (error) {
            throw new Error(`Error updating delivery zone: ${error.message}`);
        }
    }

    static async delete(id) {
        try {
            const [result] = await pool.query(
                'DELETE FROM delivery_zones WHERE zone_id = ?',
                [id]
            );

            if (result.affectedRows === 0) {
                throw new Error('Delivery zone not found');
            }

            return { message: 'Delivery zone deleted successfully' };
        } catch (error) {
            throw new Error(`Error deleting delivery zone: ${error.message}`);
        }
    }

    static async getDeliveryFee(zoneId) {
        try {
            const zone = await this.findById(zoneId);
            return zone ? zone.delivery_fee : 0.00;
        } catch (error) {
            throw new Error(`Error getting delivery fee: ${error.message}`);
        }
    }

    static async getEstimatedDeliveryTime(zoneId) {
        try {
            const zone = await this.findById(zoneId);
            return zone ? zone.estimated_delivery_time : 24;
        } catch (error) {
            throw new Error(`Error getting estimated delivery time: ${error.message}`);
        }
    }

    static async getZoneStats(zoneId) {
        try {
            const [rows] = await pool.query(`
                SELECT 
                    dz.*,
                    COUNT(dp.delivery_id) as total_delivery_personnel,
                    COUNT(CASE WHEN dp.is_available = 1 THEN 1 END) as available_personnel,
                    AVG(dp.rating) as avg_rating,
                    SUM(dp.total_deliveries) as total_deliveries,
                    COUNT(o.order_id) as total_orders,
                    SUM(o.delivery_fee) as total_delivery_fees
                FROM delivery_zones dz
                LEFT JOIN delivery_personnel dp ON dz.zone_id = dp.zone_id
                LEFT JOIN orders o ON dz.zone_id = o.delivery_zone_id
                WHERE dz.zone_id = ?
                GROUP BY dz.zone_id
            `, [zoneId]);
            
            return rows.length > 0 ? rows[0] : null;
        } catch (error) {
            throw new Error(`Error getting zone stats: ${error.message}`);
        }
    }

    static async getAllZoneStats() {
        try {
            const [rows] = await pool.query(`
                SELECT 
                    dz.*,
                    COUNT(dp.delivery_id) as total_delivery_personnel,
                    COUNT(CASE WHEN dp.is_available = 1 THEN 1 END) as available_personnel,
                    AVG(dp.rating) as avg_rating,
                    SUM(dp.total_deliveries) as total_deliveries,
                    COUNT(o.order_id) as total_orders,
                    SUM(o.delivery_fee) as total_delivery_fees
                FROM delivery_zones dz
                LEFT JOIN delivery_personnel dp ON dz.zone_id = dp.zone_id
                LEFT JOIN orders o ON dz.zone_id = o.delivery_zone_id
                WHERE dz.is_active = 1
                GROUP BY dz.zone_id
                ORDER BY dz.name_en ASC
            `);
            
            return rows;
        } catch (error) {
            throw new Error(`Error getting all zone stats: ${error.message}`);
        }
    }
}

module.exports = DeliveryZone; 