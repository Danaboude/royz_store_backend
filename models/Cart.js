// Cart model 

const { pool } = require('../db/db');

class Cart {
    constructor(data) {
        this.cart_id = data.cart_id;
        this.user_id = data.user_id;
        this.product_id = data.product_id;
        this.quantity = data.quantity;
        this.created_at = data.created_at;
        this.updated_at = data.updated_at;
        this.product_name = data.product_name;
        this.product_price = data.product_price;
        this.product_image = data.product_image;
        this.total_price = data.total_price;
    }

    // Static methods for database operations
    static async findByUser(userId) {
        try {
            const [rows] = await pool.query(`
                SELECT c.*, p.name as product_name, p.price as product_price, p.image_url as product_image,
                       p.stock, p.description, p.is_new, p.is_best_selling, p.is_deal_offer,
                       p.original_price, p.discount_percentage, p.discount_start_date, p.discount_end_date,
                       cat.name_en as category_name, u.name as vendor_name,
                       CASE 
                           WHEN p.is_deal_offer = 1 AND p.discount_percentage > 0 
                                AND p.discount_start_date <= NOW() AND p.discount_end_date >= NOW()
                           THEN p.price * (1 - p.discount_percentage / 100)
                           ELSE p.price
                       END as final_price,
                       (c.quantity * 
                           CASE 
                               WHEN p.is_deal_offer = 1 AND p.discount_percentage > 0 
                                    AND p.discount_start_date <= NOW() AND p.discount_end_date >= NOW()
                               THEN p.price * (1 - p.discount_percentage / 100)
                               ELSE p.price
                           END
                       ) as total_price,
                       CASE 
                           WHEN p.discount_start_date <= NOW() AND p.discount_end_date >= NOW() 
                           THEN 1 
                           ELSE 0 
                       END as has_active_discount
                FROM cart_items c
                JOIN products p ON c.product_id = p.product_id
                JOIN carts ca ON c.cart_id = ca.cart_id
                LEFT JOIN categories cat ON p.category_id = cat.category_id
                LEFT JOIN users u ON p.vendor_id = u.user_id
                WHERE ca.customer_id = ?
                ORDER BY c.id DESC
            `, [userId]);
            // Debug log
                        // Ensure each item has a 'quantity' field
            return rows.map(row => ({
                ...row,
                quantity: row.quantity, // should always exist now
                average_rating: 0, // Default value since we don't have ratings in this query
                review_count: 0 // Default value since we don't have review counts in this query
            }));
        } catch (error) {
            throw new Error(`Error fetching cart: ${error.message}`);
        }
    }

    static async findItem(userId, productId) {
        try {
            // Get the user's cart_id
            const [cartRows] = await pool.query(
                'SELECT cart_id FROM carts WHERE customer_id = ?',
                [userId]
            );
            if (cartRows.length === 0) return null;
            const cart_id = cartRows[0].cart_id;
            // Find the item in cart_items
            const [rows] = await pool.query(
                `SELECT c.*, p.name as product_name, p.price as product_price, p.image_url as product_image,
                       p.stock, p.description, p.is_new, p.is_best_selling, p.is_deal_offer,
                       p.original_price, p.discount_percentage, p.discount_start_date, p.discount_end_date,
                       cat.name_en as category_name, u.name as vendor_name,
                       CASE 
                           WHEN p.is_deal_offer = 1 AND p.discount_percentage > 0 
                                AND p.discount_start_date <= NOW() AND p.discount_end_date >= NOW()
                           THEN p.price * (1 - p.discount_percentage / 100)
                           ELSE p.price
                       END as final_price,
                       (c.quantity * 
                           CASE 
                               WHEN p.is_deal_offer = 1 AND p.discount_percentage > 0 
                                    AND p.discount_start_date <= NOW() AND p.discount_end_date >= NOW()
                               THEN p.price * (1 - p.discount_percentage / 100)
                               ELSE p.price
                           END
                       ) as total_price,
                       CASE 
                           WHEN p.discount_start_date <= NOW() AND p.discount_end_date >= NOW() 
                           THEN 1 
                           ELSE 0 
                       END as has_active_discount
                FROM cart_items c
                JOIN products p ON c.product_id = p.product_id
                LEFT JOIN categories cat ON p.category_id = cat.category_id
                LEFT JOIN users u ON p.vendor_id = u.user_id
                WHERE c.cart_id = ? AND c.product_id = ?`,
                [cart_id, productId]
            );
            return rows.length > 0 ? {
                ...rows[0],
                average_rating: 0, // Default value since we don't have ratings in this query
                review_count: 0 // Default value since we don't have review counts in this query
            } : null;
        } catch (error) {
            throw new Error(`Error fetching cart item: ${error.message}`);
        }
    }

    static async addItem(cartData) {
        try {
            const { user_id, product_id, quantity } = cartData;
            if (!user_id || !product_id || !quantity) {
                throw new Error('User ID, product ID, and quantity are required');
            }
            if (quantity <= 0) {
                throw new Error('Quantity must be greater than 0');
            }
            // 1. Find or create the user's cart
            let cart_id;
            const [cartRows] = await pool.query(
                'SELECT cart_id FROM carts WHERE customer_id = ?',
                [user_id]
            );
            if (cartRows.length === 0) {
                const [result] = await pool.query(
                    'INSERT INTO carts (customer_id) VALUES (?)',
                    [user_id]
                );
                cart_id = result.insertId;
            } else {
                cart_id = cartRows[0].cart_id;
            }
            // 2. Check if product exists and get stock info
            const [product] = await pool.query(
                'SELECT stock FROM products WHERE product_id = ? AND deleted = 0',
                [product_id]
            );
            if (product.length === 0) {
                throw new Error('Product not found');
            }
            
            const availableStock = product[0].stock;
            
            // 3. Check if item already exists in cart
            const [existing] = await pool.query(
                'SELECT * FROM cart_items WHERE cart_id = ? AND product_id = ?',
                [cart_id, product_id]
            );
            
            if (existing.length > 0) {
                // Update existing item
                const currentQuantity = existing[0].quantity;
                const newQuantity = currentQuantity + quantity;
                
                // Check stock limits more gracefully
                if (availableStock > 0 && newQuantity > availableStock) {
                    // If stock is limited, set quantity to available stock
                    const maxAllowedQuantity = availableStock;
                    await pool.query(
                        'UPDATE cart_items SET quantity = ? WHERE cart_id = ? AND product_id = ?',
                        [maxAllowedQuantity, cart_id, product_id]
                    );
                    return { 
                        message: 'cart.itemUpdated',
                        quantityLimited: true,
                        maxQuantity: maxAllowedQuantity
                    };
                } else {
                    // Normal update
                    await pool.query(
                        'UPDATE cart_items SET quantity = ? WHERE cart_id = ? AND product_id = ?',
                        [newQuantity, cart_id, product_id]
                    );
                    return { message: 'cart.itemUpdated' };
                }
            } else {
                // Add new item
                // Check stock limits for new items
                if (availableStock > 0 && quantity > availableStock) {
                    // If stock is limited, set quantity to available stock
                    const maxAllowedQuantity = availableStock;
                    await pool.query(
                        'INSERT INTO cart_items (cart_id, product_id, quantity) VALUES (?, ?, ?)',
                        [cart_id, product_id, maxAllowedQuantity]
                    );
                    return { 
                        message: 'cart.itemAddedLimited',
                        quantityLimited: true,
                        maxQuantity: maxAllowedQuantity
                    };
                } else {
                    // Normal add
                    await pool.query(
                        'INSERT INTO cart_items (cart_id, product_id, quantity) VALUES (?, ?, ?)',
                        [cart_id, product_id, quantity]
                    );
                    return { message: 'cart.itemAdded' };
                }
            }
        } catch (error) {
            throw new Error(`Error adding item to cart: ${error.message}`);
        }
    }

    static async updateQuantity(userId, productId, quantity) {
        try {
            if (quantity <= 0) {
                throw new Error('Quantity must be greater than 0');
            }
            // Get the user's cart_id
            const [cartRows] = await pool.query(
                'SELECT cart_id FROM carts WHERE customer_id = ?',
                [userId]
            );
            if (cartRows.length === 0) {
                throw new Error('Cart not found for user');
            }
            const cart_id = cartRows[0].cart_id;
            // Check if product exists
            const [product] = await pool.query(
                'SELECT stock FROM products WHERE product_id = ? AND deleted = 0',
                [productId]
            );
            if (product.length === 0) {
                throw new Error('Product not found');
            }
            
            const availableStock = product[0].stock;
            
            // Check stock limits more gracefully
            let finalQuantity = quantity;
            let message = 'cart.itemUpdated';
            let quantityLimited = false;
            
            if (availableStock > 0 && quantity > availableStock) {
                // If stock is limited, set quantity to available stock
                finalQuantity = availableStock;
                message = 'cart.quantityLimited';
                quantityLimited = true;
            } else if (availableStock === 0) {
                message = 'cart.itemUpdatedOutOfStock';
            }
            
            // Update the cart item
            const [result] = await pool.query(
                'UPDATE cart_items SET quantity = ? WHERE cart_id = ? AND product_id = ?',
                [finalQuantity, cart_id, productId]
            );
            if (result.affectedRows === 0) {
                throw new Error('Cart item not found');
            }
            
            return { 
                message,
                quantityLimited,
                maxQuantity: quantityLimited ? availableStock : null
            };
        } catch (error) {
            throw new Error(`Error updating cart item: ${error.message}`);
        }
    }

    static async removeItem(userId, productId) {
        try {
                        // Get the user's cart_id
            const [cartRows] = await pool.query(
                'SELECT cart_id FROM carts WHERE customer_id = ?',
                [userId]
            );
                        if (cartRows.length === 0) {
                throw new Error('Cart not found for user');
            }
            const cart_id = cartRows[0].cart_id;
                        // Debug: Show all cart items for this cart
            const [allCartItems] = await pool.query(
                'SELECT ci.*, p.name as product_name FROM cart_items ci JOIN products p ON ci.product_id = p.product_id WHERE ci.cart_id = ?',
                [cart_id]
            );
                        // Check if the item exists before trying to delete it
            const [existingItem] = await pool.query(
                'SELECT * FROM cart_items WHERE cart_id = ? AND product_id = ?',
                [cart_id, productId]
            );
                        if (existingItem.length === 0) {
                throw new Error('Cart item not found');
            }
            
            // Remove the item from cart_items
            const [result] = await pool.query(
                'DELETE FROM cart_items WHERE cart_id = ? AND product_id = ?',
                [cart_id, productId]
            );
                        if (result.affectedRows === 0) {
                throw new Error('Cart item not found');
            }
            return { message: 'Item removed from cart successfully' };
        } catch (error) {
            throw new Error(`Error removing cart item: ${error.message}`);
        }
    }

    static async clearCart(userId) {
        try {
            // Find all cart_ids for this customer
            const [carts] = await pool.query('SELECT cart_id FROM carts WHERE customer_id = ?', [userId]);
            const cartIds = carts.map(c => c.cart_id);
            if (cartIds.length === 0) {
                return { message: 'No cart found for user', itemsRemoved: 0 };
            }
            // Delete all cart_items for these cart_ids
            const [result] = await pool.query(
                `DELETE FROM cart_items WHERE cart_id IN (${cartIds.map(() => '?').join(',')})`,
                cartIds
            );
            return { message: 'Cart cleared successfully', itemsRemoved: result.affectedRows };
        } catch (error) {
            throw new Error(`Error clearing cart: ${error.message}`);
        }
    }

    static async getCartTotal(userId) {
        try {
            const [rows] = await pool.query(`
                SELECT SUM(c.quantity * 
                    CASE 
                        WHEN p.is_deal_offer = 1 AND p.discount_percentage > 0 
                             AND p.discount_start_date <= NOW() AND p.discount_end_date >= NOW()
                        THEN p.price * (1 - p.discount_percentage / 100)
                        ELSE p.price
                    END
                ) as total
                FROM cart_items c
                JOIN products p ON c.product_id = p.product_id
                JOIN carts ca ON c.cart_id = ca.cart_id
                WHERE ca.customer_id = ?
            `, [userId]);
            return rows[0].total || 0;
        } catch (error) {
            throw new Error(`Error calculating cart total: ${error.message}`);
        }
    }

    static async getCartItemCount(userId) {
        try {
            const [rows] = await pool.query(`
                SELECT SUM(c.quantity) as count
                FROM cart_items c
                JOIN carts ca ON c.cart_id = ca.cart_id
                WHERE ca.customer_id = ?
            `, [userId]);
            return rows[0].count || 0;
        } catch (error) {
            throw new Error(`Error counting cart items: ${error.message}`);
        }
    }

    static async validateCartItems(userId) {
        try {
            const [rows] = await pool.query(`
                SELECT c.*, p.stock, p.name
                FROM cart_items c
                JOIN products p ON c.product_id = p.product_id
                JOIN carts ca ON c.cart_id = ca.cart_id
                WHERE ca.customer_id = ?
            `, [userId]);

            const invalidItems = [];
            const validItems = [];

            for (const item of rows) {
                if (item.quantity > item.stock) {
                    invalidItems.push({
                        product_id: item.product_id,
                        product_name: item.name,
                        requested_quantity: item.quantity,
                        available_stock: item.stock,
                        message: 'Insufficient stock'
                    });
                } else {
                    validItems.push(item);
                }
            }

            return { validItems, invalidItems };
        } catch (error) {
            throw new Error(`Error validating cart items: ${error.message}`);
        }
    }

    static async moveToOrder(userId, orderId, productIds = null) {
        try {
            let cartItems = await this.findByUser(userId);
            if (productIds && Array.isArray(productIds) && productIds.length > 0) {
                cartItems = cartItems.filter(item => productIds.includes(item.product_id));
            }
            if (cartItems.length === 0) {
                throw new Error('Cart is empty');
            }

            // Validate items
            const { validItems, invalidItems } = await this.validateCartItems(userId);
            let itemsToMove = validItems;
            if (productIds && Array.isArray(productIds) && productIds.length > 0) {
                itemsToMove = validItems.filter(item => productIds.includes(item.product_id));
            }
            if (itemsToMove.length === 0) {
                throw new Error('Some items have insufficient stock');
            }

            // Move items to order
            for (const item of itemsToMove) {
                await pool.query(
                    'INSERT INTO order_items (order_id, product_id, qty, price) VALUES (?, ?, ?, ?)',
                    [orderId, item.product_id, item.quantity, item.product_price]
                );
                // Update product stock
                await pool.query(
                    'UPDATE products SET stock = stock - ? WHERE product_id = ?',
                    [item.quantity, item.product_id]
                );
                // Remove from cart_items
                await pool.query(
                    'DELETE FROM cart_items WHERE cart_id = ? AND product_id = ?',
                    [item.cart_id, item.product_id]
                );
            }
            return {
                message: 'Cart items moved to order successfully',
                itemsMoved: itemsToMove.length
            };
        } catch (error) {
            throw new Error(`Error moving cart to order: ${error.message}`);
        }
    }

    static async moveToOrderWithDiscounts(userId, orderId, productIds = null) {
        try {
            // Get cart items with deal offer discounts
            const cart = await this.findByCustomerId(userId);
            if (!cart || !cart.items || cart.items.length === 0) {
                throw new Error('Cart is empty');
            }

            let itemsToMove = cart.items;
            if (productIds && Array.isArray(productIds) && productIds.length > 0) {
                itemsToMove = cart.items.filter(item => productIds.includes(item.product_id));
            }
            if (itemsToMove.length === 0) {
                throw new Error('No items to move');
            }

            // Validate items
            const { validItems, invalidItems } = await this.validateCartItems(userId);
            const validProductIds = validItems.map(item => item.product_id);
            itemsToMove = itemsToMove.filter(item => validProductIds.includes(item.product_id));
            
            if (itemsToMove.length === 0) {
                throw new Error('Some items have insufficient stock');
            }

            // Move items to order with discounted prices
            for (const item of itemsToMove) {
                // Use final_price (with deal offer discounts) instead of product_price
                const finalPrice = item.final_price || item.product_price;
                
                await pool.query(
                    'INSERT INTO order_items (order_id, product_id, qty, price, total_price) VALUES (?, ?, ?, ?, ?)',
                    [orderId, item.product_id, item.quantity, finalPrice, finalPrice * item.quantity]
                );
                
                // Update product stock
                await pool.query(
                    'UPDATE products SET stock = stock - ? WHERE product_id = ?',
                    [item.quantity, item.product_id]
                );
                
                // Remove from cart_items
                await pool.query(
                    'DELETE FROM cart_items WHERE cart_id = ? AND product_id = ?',
                    [item.cart_id, item.product_id]
                );
            }
            
            return {
                message: 'Cart items moved to order successfully with discounts',
                itemsMoved: itemsToMove.length
            };
        } catch (error) {
            throw new Error(`Error moving cart to order with discounts: ${error.message}`);
        }
    }

    static async findByCustomerId(customer_id) {
        const [rows] = await pool.query(
            'SELECT * FROM carts WHERE customer_id = ? ORDER BY cart_id DESC LIMIT 1',
            [customer_id]
        );
        if (!rows.length) return null;
        const cart = rows[0];
        // Fetch cart items with vendor, price info, and deal offer discounts
        const [items] = await pool.query(
            `SELECT ci.*, p.vendor_id, p.price as product_price, p.is_deal_offer, 
                    p.discount_percentage, p.discount_start_date, p.discount_end_date,
                    CASE 
                        WHEN p.is_deal_offer = 1 AND p.discount_percentage > 0 
                             AND p.discount_start_date <= NOW() AND p.discount_end_date >= NOW()
                        THEN p.price * (1 - p.discount_percentage / 100)
                        ELSE p.price
                    END as final_price
             FROM cart_items ci
             JOIN products p ON ci.product_id = p.product_id
             WHERE ci.cart_id = ?`,
            [cart.cart_id]
        );
        cart.items = items;
        cart.total = items.reduce((sum, item) => sum + (item.final_price * item.quantity), 0);
        return cart;
    }

    // Instance methods
    toJSON() {
        return {
            cart_id: this.cart_id,
            user_id: this.user_id,
            product_id: this.product_id,
            quantity: this.quantity,
            product_name: this.product_name,
            product_price: this.product_price,
            product_image: this.product_image,
            total_price: this.total_price,
            created_at: this.created_at,
            updated_at: this.updated_at
        };
    }
}

module.exports = Cart; 