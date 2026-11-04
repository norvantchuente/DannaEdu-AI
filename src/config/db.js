// src/config/db.js
const mysql = require('mysql2/promise');
require('dotenv').config();

// Création d'un pool de connexions pour optimiser les performances
const pool = mysql.createPool({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'dannaedu_db',
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
});

// Test de la connexion
async function testConnection() {
    try {
        const connection = await pool.getConnection();
        console.log('✅ Connexion à la base de données MySQL établie avec succès.');
        connection.release();
    } catch (error) {
        console.error('❌ Erreur de connexion à MySQL :', error.message);
    }
}

testConnection();

module.exports = pool;