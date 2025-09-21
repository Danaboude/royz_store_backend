// Carts routes 

const express = require('express');
const { 
    getCart, 
    addToCart, 
    updateCartItem, 
    removeFromCart, 
    clearCart 
} = require('../controllers/CartsController');
const { authenticateJWT, authorizeRoles } = require('../middleware/auth');
const Cart = require('../models/Cart');

const router = express.Router();

// All cart operations require authentication and customer role
router.use(authenticateJWT);
router.use(authorizeRoles([2, 3])); // Allow both roleId 2 and 3 as customers

router.get("/", getCart);
router.post("/add", addToCart);
router.put("/item/:product_id", updateCartItem);
router.delete("/item/:product_id", removeFromCart);
router.delete("/clear", clearCart);

router.get("/count", async (req, res) => {
    try {
        const customer_id = req.user.id;
        const count = await Cart.getCartItemCount(customer_id);
        res.json({ count });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

module.exports = router; 