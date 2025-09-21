// Delivery Addresses routes 

const express = require('express');
const { 
    getDeliveryAddresses, 
    getDeliveryAddressById, 
    createDeliveryAddress, 
    updateDeliveryAddress, 
    deleteDeliveryAddress 
} = require('../controllers/DeliveryAddressesController');
const { authenticateJWT, authorizeRoles } = require('../middleware/auth');

const router = express.Router();

// All delivery address operations require authentication and customer role
router.use(authenticateJWT);
router.use(authorizeRoles([2, 3])); // Allow customers (2) and vendors (3) to manage delivery addresses

router.get("/", getDeliveryAddresses);
router.get("/:id", getDeliveryAddressById);
router.post("/", createDeliveryAddress);
router.put("/:id", updateDeliveryAddress);
router.delete("/:id", deleteDeliveryAddress);

module.exports = router; 