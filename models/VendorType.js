const { pool } = require('../db/db');

class VendorType {
    constructor(data) {
        this.vendor_type_id = data.vendor_type_id;
        this.name_en = data.name_en;
        this.name_ar = data.name_ar;
        this.description_en = data.description_en;
        this.description_ar = data.description_ar;
        this.commission_rate = data.commission_rate;
        this.created_at = data.created_at;
    }

    static async findAll() {
        try {
            const [rows] = await pool.query(`
                SELECT * FROM vendor_types 
                ORDER BY name_en
            `);
            return rows;
        } catch (error) {
            throw new Error(`Error fetching vendor types: ${error.message}`);
        }
    }

    static async findById(id) {
        try {
            const [rows] = await pool.query(`
                SELECT * FROM vendor_types 
                WHERE vendor_type_id = ?
            `, [id]);
            
            return rows.length > 0 ? rows[0] : null;
        } catch (error) {
            throw new Error(`Error fetching vendor type: ${error.message}`);
        }
    }

    static async create(vendorTypeData) {
        try {
            const { name_en, name_ar, description_en, description_ar, commission_rate } = vendorTypeData;
            
            if (!name_en || !name_ar) {
                throw new Error('Name in both English and Arabic is required');
            }

            const [result] = await pool.query(
                'INSERT INTO vendor_types (name_en, name_ar, description_en, description_ar, commission_rate) VALUES (?, ?, ?, ?, ?)',
                [name_en, name_ar, description_en, description_ar, commission_rate]
            );
            
            return { vendor_type_id: result.insertId, message: 'Vendor type created successfully' };
        } catch (error) {
            throw new Error(`Error creating vendor type: ${error.message}`);
        }
    }

    static async update(id, updateData) {
        try {
            const { name_en, name_ar, description_en, description_ar, commission_rate } = updateData;
            
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
            if (commission_rate !== undefined) {
                updateFields.push('commission_rate = ?');
                params.push(commission_rate);
            }

            if (updateFields.length === 0) {
                throw new Error('No fields to update');
            }

            params.push(id);

            const [result] = await pool.query(
                `UPDATE vendor_types SET ${updateFields.join(', ')} WHERE vendor_type_id = ?`,
                params
            );

            if (result.affectedRows === 0) {
                throw new Error('Vendor type not found');
            }

            return { message: 'Vendor type updated successfully' };
        } catch (error) {
            throw new Error(`Error updating vendor type: ${error.message}`);
        }
    }

    static async delete(id) {
        try {
            const [result] = await pool.query(
                'DELETE FROM vendor_types WHERE vendor_type_id = ?',
                [id]
            );

            if (result.affectedRows === 0) {
                throw new Error('Vendor type not found');
            }

            return { message: 'Vendor type deleted successfully' };
        } catch (error) {
            throw new Error(`Error deleting vendor type: ${error.message}`);
        }
    }
}

module.exports = VendorType; 