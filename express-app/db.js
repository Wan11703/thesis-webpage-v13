

const mysql = require('mysql2');
require("dotenv").config();
var colors = require('colors');

const dbConnection = mysql.createPool({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  connectionLimit: 10
});
// Changed url 
// test the connection
dbConnection.getConnection((err, connection) => {
  if (err) {
    console.error("Error connecting:", err);
  } else {
    console.log("Connected to MySQL!".cyan);
    connection.release();
  }
});

module.exports = dbConnection;

//reverted some railway stuff
//added db port
//chenged env variables to match railway v2
// changed some stuff to use pool instead of single connection
// changed to mysql2
// added connection limit
//enabled "enables static ips" in railway setting


