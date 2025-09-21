// db/db.js
const mysql = require('mysql2/promise'); 
require('dotenv').config();

const pool = mysql.createPool({ 
    host: process.env.DB_HOST || 'royz-store_ecommerce',
    port: process.env.DB_PORT || 3306,
    user: process.env.DB_USER || 'mysql',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'ecommerce',
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
});

// Test database connection
(async () => {
    try {
        await pool.query('SELECT 1'); 
        console.log('✅ Database connected successfully');
    } catch (err) {
        console.error('❌ Database connection failed!', err);
    }
})();

// Create a cache object for compatibility
const cache = {
    redisClient: null
};

// Add getConnection method for transactions
const getConnection = async () => {
    return await pool.getConnection();
};

module.exports = { pool, cache, getConnection }; 