const mysql = require('mysql2');
require("dotenv").config();
var colors = require('colors');

const dbConnection = mysql.createConnection({
  host: process.env.MYSQLHOST,
  port: process.env.MYSQLPORT,
  user: process.env.MYSQLUSER,
  password: process.env.MYSQLPASSWORD,
  database: process.env.MYSQL_DATABASE,
  connectionLimit: 10
});
// Changed url and port
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


