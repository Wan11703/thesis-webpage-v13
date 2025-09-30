const mysql = require('mysql2');
require("dotenv").config();
var colors = require('colors');

const dbConnection = mysql.createConnection({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  connectionLimit: 10
});
// Changed url to env
// test the connection
dbConnection.connect((error) => {
  if (error) {
    console.log("❌ Connection error:", error);
  } else {
    console.log("✅ Connected to the MySQL database!");
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


