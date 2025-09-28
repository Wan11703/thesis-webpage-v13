const mysql = require('mysql2');
var colors = require('colors');
require("dotenv").config();

const pool = mysql.createPool({
    host: process.env.DB_HOST,
    user: process.env.DB_USERNAME,
    password: process.env.DB_ROOT_PASSWORD,
    database: process.env.DATABASE,
    port: process.env.DB_PORT,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
});

module.exports = { dbConnection: pool };

dbConnection.connect(function(err){
    if(!err){
        console.log("Connected to the MySQL server!".underline.cyan);
    } else{
        console.error("Error connecting: " + err.stack);
    }
});

module.exports = {dbConnection};