const mysql = require('mysql2');
require("dotenv").config();
var colors = require('colors');

const dbConnection = mysql.createPool({
    host: process.env.DB_HOST,
    user: process.env.DB_USERNAME,
    password: process.env.DB_ROOT_PASSWORD,
    database: process.env.DATABASE,
    port: process.env.DB_PORT,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
});

// test the connection
dbConnection.getConnection((err, connection) => {
    if (err) {
        console.error("Error connecting: " + err.stack);
    } else {
        console.log("Connected to the MySQL server!".underline.cyan);
        connection.release();
    }
});

module.exports = dbConnection;
//reverted some railway stuff

