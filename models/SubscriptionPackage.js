const { pool } = require('../db/db');

class SubscriptionPackage {
    constructor(data) {
        this.package_id = data.package_id;
        this.vendor_type_id = data.vendor_type_id;
        this.name_en = data.name_en;
        this.name_ar = data.name_ar;
        this.description_en = data.description_en;
        this.description_ar = data.description_ar;
        this.price = data.price;
        this.price_2weeks = data.price_2weeks;
        this.duration_months = data.duration_months;
        this.duration_2weeks = data.duration_2weeks;
        this.features_en = data.features_en;
        this.features_ar = data.features_ar;
        this.max_products = data.max_products;
        this.commission_rate = data.commission_rate;
        this.is_active = data.is_active;
        this.is_popular = data.is_popular;
        this.created_at = data.created_at;
    }

    static async findAll() {
        try {
            const [rows] = await pool.query(`
                SELECT sp.*, vt.name_en as vendor_type_name_en, vt.name_ar as vendor_type_name_ar
                FROM subscription_packages sp
                JOIN vendor_types vt ON sp.vendor_type_id = vt.vendor_type_id
                ORDER BY sp.vendor_type_id, sp.price
            `);
            return rows;
        } catch (error) {
            throw new Error(`Error fetching subscription packages: ${error.message}`);
        }
    }

    static async findByVendorType(vendorTypeId) {
        try {
            const [rows] = await pool.query(`
                SELECT sp.*, vt.name_en as vendor_type_name_en, vt.name_ar as vendor_type_name_ar
                FROM subscription_packages sp
                JOIN vendor_types vt ON sp.vendor_type_id = vt.vendor_type_id
                WHERE sp.vendor_type_id = ? AND sp.is_active = 1
                ORDER BY sp.price
            `, [vendorTypeId]);
            return rows;
        } catch (error) {
            throw new Error(`Error fetching subscription packages: ${error.message}`);
        }
    }

    static async findById(id) {
        try {
            const [rows] = await pool.query(`
                SELECT sp.*, vt.name_en as vendor_type_name_en, vt.name_ar as vendor_type_name_ar
                FROM subscription_packages sp
                JOIN vendor_types vt ON sp.vendor_type_id = vt.vendor_type_id
                WHERE sp.package_id = ?
            `, [id]);
            
            return rows.length > 0 ? rows[0] : null;
        } catch (error) {
            throw new Error(`Error fetching subscription package: ${error.message}`);
        }
    }

    static async create(packageData) {
        try {
            const { 
                vendor_type_id, name_en, name_ar, description_en, description_ar, 
                price, duration_months, features_en, features_ar, max_products, commission_rate, is_popular 
            } = packageData;
            
            if (!vendor_type_id || !name_en || !name_ar || !price) {
                throw new Error('Vendor type, name, and price are required');
            }

            const [result] = await pool.query(
                'INSERT INTO subscription_packages (vendor_type_id, name_en, name_ar, description_en, description_ar, price, duration_months, features_en, features_ar, max_products, commission_rate, is_popular) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
                [vendor_type_id, name_en, name_ar, description_en, description_ar, price, duration_months, features_en, features_ar, max_products, commission_rate, is_popular]
            );
            
            return { package_id: result.insertId, message: 'Subscription package created successfully' };
        } catch (error) {
            throw new Error(`Error creating subscription package: ${error.message}`);
        }
    }

    static async update(id, updateData) {
        try {
            const { 
                name_en, name_ar, description_en, description_ar, 
                price, duration_months, features_en, features_ar, 
                max_products, commission_rate, is_active, is_popular 
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
            if (description_en !== undefined) {
                updateFields.push('description_en = ?');
                params.push(description_en);
            }
            if (description_ar !== undefined) {
                updateFields.push('description_ar = ?');
                params.push(description_ar);
            }
            if (price !== undefined) {
                updateFields.push('price = ?');
                params.push(price);
            }
            if (duration_months !== undefined) {
                updateFields.push('duration_months = ?');
                params.push(duration_months);
            }
            if (features_en !== undefined) {
                updateFields.push('features_en = ?');
                params.push(features_en);
            }
            if (features_ar !== undefined) {
                updateFields.push('features_ar = ?');
                params.push(features_ar);
            }
            if (max_products !== undefined) {
                updateFields.push('max_products = ?');
                params.push(max_products);
            }
            if (commission_rate !== undefined) {
                updateFields.push('commission_rate = ?');
                params.push(commission_rate);
            }
            if (is_active !== undefined) {
                updateFields.push('is_active = ?');
                params.push(is_active);
            }
            if (is_popular !== undefined) {
                updateFields.push('is_popular = ?');
                params.push(is_popular);
            }

            if (updateFields.length === 0) {
                throw new Error('No fields to update');
            }

            params.push(id);

            const [result] = await pool.query(
                `UPDATE subscription_packages SET ${updateFields.join(', ')} WHERE package_id = ?`,
                params
            );

            if (result.affectedRows === 0) {
                throw new Error('Subscription package not found');
            }

            return { message: 'Subscription package updated successfully' };
        } catch (error) {
            throw new Error(`Error updating subscription package: ${error.message}`);
        }
    }

    static async delete(id) {
        try {
            const [result] = await pool.query(
                'DELETE FROM subscription_packages WHERE package_id = ?',
                [id]
            );

            if (result.affectedRows === 0) {
                throw new Error('Subscription package not found');
            }

            return { message: 'Subscription package deleted successfully' };
        } catch (error) {
            throw new Error(`Error deleting subscription package: ${error.message}`);
        }
    }

    static async getPopularPackages() {
        try {
            const [rows] = await pool.query(`
                SELECT sp.*, vt.name_en as vendor_type_name_en, vt.name_ar as vendor_type_name_ar
                FROM subscription_packages sp
                JOIN vendor_types vt ON sp.vendor_type_id = vt.vendor_type_id
                WHERE sp.is_popular = 1 AND sp.is_active = 1
                ORDER BY sp.vendor_type_id, sp.price
            `);
            return rows;
        } catch (error) {
            throw new Error(`Error fetching popular packages: ${error.message}`);
        }
    }
}

module.exports = SubscriptionPackage; 