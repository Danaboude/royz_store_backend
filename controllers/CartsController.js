// Carts Controller 

const Cart = require('../models/Cart');

async function getCart(req, res) {
    try {
        const customer_id = req.user.id;
        const cartItems = await Cart.findByUser(customer_id);
        const total = await Cart.getCartTotal(customer_id);
        
        res.json({
            id: customer_id, // Using customer_id as cart id
            user_id: customer_id,
            items: cartItems,
            total: total,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Server Error', details: error.message });
    }
}

async function addToCart(req, res) {
    try {
        if (!req.user) {
            return res.status(401).json({ error: 'Unauthorized: Please log in.' });
        }
        const customer_id = req.user.id;
        const { product_id, quantity = 1 } = req.body;

        if (!product_id || quantity <= 0) {
            return res.status(400).json({ error: 'Valid product_id and quantity are required' });
        }

        const result = await Cart.addItem({ user_id: customer_id, product_id, quantity });
        res.json({ message: result.message });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: error.message || 'Server Error' });
    }
}

async function updateCartItem(req, res) {
    try {
        const customer_id = req.user.id;
        const { product_id } = req.params;
        const { quantity } = req.body;

        if (!quantity || quantity <= 0) {
            return res.status(400).json({ error: 'Valid quantity is required' });
        }

        const result = await Cart.updateQuantity(customer_id, product_id, quantity);
        
        // Return updated cart data in the format expected by frontend
        const cartItems = await Cart.findByUser(customer_id);
        const total = await Cart.getCartTotal(customer_id);
        
        res.json({
            id: customer_id, // Using customer_id as cart id
            user_id: customer_id,
            items: cartItems,
            total: total,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
            message: result.message
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Server Error', details: error.message });
    }
}

async function removeFromCart(req, res) {
    try {
        const customer_id = req.user.id;
        const { product_id } = req.params;
        
                const result = await Cart.removeItem(customer_id, product_id);
        
        // Return updated cart data in the format expected by frontend
        const cartItems = await Cart.findByUser(customer_id);
        const total = await Cart.getCartTotal(customer_id);
        
        res.json({
            id: customer_id, // Using customer_id as cart id
            user_id: customer_id,
            items: cartItems,
            total: total,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
            message: result.message
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Server Error', details: error.message });
    }
}

async function clearCart(req, res) {
    try {
        const customer_id = req.user.id;
        const result = await Cart.clearCart(customer_id);
        res.json({ message: result.message, itemsRemoved: result.itemsRemoved });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Server Error', details: error.message });
    }
}

module.exports = { 
    getCart, 
    addToCart, 
    updateCartItem, 
    removeFromCart, 
    clearCart 
}; 