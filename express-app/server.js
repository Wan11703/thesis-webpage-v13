// changes  

const express = require("express");
const multer = require("multer");
const path = require("path");
const bcrypt = require("bcryptjs");
const session = require("express-session");
// const bodyParser = require("body-parser");

const fs = require('fs');
const util = require('util');
const unlinkFile = util.promisify(fs.unlink);

// const multerS3 = require("multer-s3-v2");
// const { s3, getImageStream, deleteImage } = require("./s3.js");
const dbConnection = require("./db");



const storage = multer.memoryStorage(); // or use multer.diskStorage({...}) for disk

const upload = multer({
    storage: storage,
    limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
    fileFilter: function (req, file, cb) {
        const allowedTypes = /jpeg|jpg|png/;
        const ext = allowedTypes.test(path.extname(file.originalname).toLowerCase());
        const mime = allowedTypes.test(file.mimetype);
        if (ext && mime) cb(null, true);
        else cb("Only images (jpeg, jpg, png) are allowed!");
    }
}).single("file[0]");

const formUpload = multer();

function checkFileType(file, cb) {
    const fileTypes = /jpeg|png|jpg/;
    const extname = fileTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = fileTypes.test(file.mimetype);

    if (mimetype && extname) {
        return cb(null, true);
    } else {
        cb("Please upload images only!");
    }
}

// const port = 3000;
const port = process.env.PORT || 3000;

const app = express();

// app.use(express.json());
// app.use(express.urlencoded({ extended: true }));

app.use(express.json({ limit: "10mb" }));  // allow up to ~10 MB
app.use(express.urlencoded({ extended: true, limit: "10mb" }));

app.set("view engine", "ejs");

app.use(express.static("public"));

app.use(session({
    name: 'session_id', // this stuff
    secret: process.env.SESSION_SECRET || 'fallback-secret', // use env var in real app
    resave: false,
    saveUninitialized: false,
    cookie: { secure: false } // set true if using HTTPS
}));

// index

app.get("/", (req, res) => {
    res.render("index");
});

// guest

app.get("/guest-login", (req, res) => {
    res.render("guest/guest-login");
});

app.get("/guest-register", (req, res) => {
    res.render("guest/guest-register");
});

// user

app.get("/user-search", (req, res) => {
    if (!req.session.user) {
        return res.redirect("/guest-login");
    }

    res.render("user/user-search", {
        username: req.session.user.username,
    });
});

app.get("/user-settings", async (req, res) => {
    if (!req.session.user) {
        return res.redirect("/guest-login");
    }

    try {
        const [user] = await queryAsync(
            "SELECT email, username, password_datetime FROM user_tbl WHERE user_id = ?",
            [req.session.user.id]
        );

        let formattedPasswordDatetime = "Not set";

        if (user.password_datetime) {
            const dt = new Date(user.password_datetime);
            // Example: Sep 12, 2025, 7:34 PM
            formattedPasswordDatetime = dt.toLocaleString("en-US", {
                month: "short",
                day: "numeric",
                year: "numeric",
                hour: "numeric",
                minute: "2-digit",
                hour12: true,
            });
        }

        res.render("user/user-settings", {
            email: user.email,
            username: user.username,
            password_datetime: formattedPasswordDatetime,
        });
    } catch (error) {
        console.error("Error fetching user settings:", error);
        res.status(500).send("Failed to load settings.");
    }
});



const cors = require('cors');
app.use(cors({
    origin: 'thesis-webpage-v12-production.up.railway.app',
    credentials: true
  }));


app.get("/user-extract", (req, res) => {
    if (!req.session.user) {
        return res.redirect("/guest-login");
    }

    const userId = req.session.user.id;

    dbConnection.query(
        "SELECT user_id, username, image, image_type FROM user_tbl WHERE user_id = ?",
        [userId],
        (err, results) => {
            if (err) {
                console.error(err);
                return res.status(500).send("Database error.");
            }

            // Only include rows with non-empty images
            const images = results.filter((result) => result.image);

            res.render("user/user-extract", {
                images,
                username: req.session.user.username,
                userId: userId, // ✅ pass userId to EJS
            });
        }
    );
});


app.get("/logout", (req, res) => {
    req.session.destroy(err => {
        if (err) return res.status(500).send("Logout failed.");
        res.redirect("/guest-login");
    });
});



app.post("/upload", (req, res) => {
    if (!req.session.user) {
      return res.status(401).json({ message: "Unauthorized" });
    }
  
    const userId = req.session.user.id;
  
    upload(req, res, (err) => {
      if (err) {
        return res.status(400).json({ message: err.message || "Upload error." });
      }
  
      if (!req.file) {
        return res.status(400).json({ message: "No file uploaded." });
      }
  
      const { buffer, mimetype } = req.file;
      const updateQuery = "UPDATE user_tbl SET image = ?, image_type = ? WHERE user_id = ?";
  
      dbConnection.query(updateQuery, [buffer, mimetype, userId], (err) => {
        if (err) {
          console.error(err);
          return res.status(500).json({ message: "Failed to save image." });
        }
  
        res.status(200).json({ message: "Image uploaded successfully!" });
      });
    });
  });



app.put("/delete", (req, res) => {
    if (!req.session.user) {
      return res.status(401).json({ message: "Unauthorized" });
    }
  
    const userId = req.session.user.id;
    const query = "UPDATE user_tbl SET image = NULL, image_type = NULL WHERE user_id = ?";
  
    dbConnection.query(query, [userId], (err) => {
      if (err) {
        console.error(err);
        return res.status(500).json({ message: "Failed to delete image." });
      }
      res.status(200).json({ message: "Image deleted successfully!" });
    });
  });



// app.get("/:image_key", (req, res) => {
//     const readStream = getImageStream(req.params.image_key);
//     readStream.pipe(res);
// })

app.get("/user-image/:id", (req, res) => {
    console.log("Session user ID:", req.session.user?.id);
    console.log("Requested user ID:", req.params.id);

    if (!req.session.user || parseInt(req.params.id) !== req.session.user.id) {
        return res.status(403).send("Access denied.");
    }

    const userId = req.params.id;

    dbConnection.query("SELECT image, image_type FROM user_tbl WHERE user_id = ?", [userId], (err, results) => {
        if (err) return res.status(500).send("Error fetching image");
        if (results.length === 0 || !results[0].image) return res.status(404).send("Image not found");

        const image = results[0].image;
        const imageType = results[0].image_type;

        res.writeHead(200, { "Content-Type": imageType });
        res.end(image, "binary");
    });
});


app.get("/api/image-proxy/:id", async (req, res) => {
    const userId = parseInt(req.params.id);

    if (!req.session.user || req.session.user.id !== userId) { return res.status(403).send("Access denied"); }

    

    dbConnection.query("SELECT image, image_type FROM user_tbl WHERE user_id = ?", [userId], (err, results) => {
        if (err) { console.error("DB Error:", err); return res.status(500).send("Error fetching image"); }
        if (results.length === 0 || !results[0].image) return res.status(404).send("Image not found");

        const imageBuffer = results[0].image;
        const imageType = results[0].image_type || "image/jpeg";

        res.writeHead(200, { "Content-Type": imageType });
        res.send(imageBuffer);
    });
});




  

function saveImagesInDB(images) {
    for (let i = 0; i < images.length; i++) {
        dbConnection.query("INSERT INTO user_tbl (user_id, image_key) VALUES (?, ?)",
            [user_id, images[i].key], (err, result) => {
                if (err) throw new Error(err);
            })
    }

}

app.listen(port, () => {
    console.log(`Server is running on port ${port}`);
});


function deleteImagesFromDB(images) {
    for (let i = 0; i < images.length; i++) {
        dbConnection.query("DELETE FROM user_tbl WHERE user_id = ? AND image_key = ?",
            [user_id, images[i]], (err, result) => {
                if (err) throw new Error(err);
            })
    }
}

// new

app.post("/register", formUpload.none(), (req, res) => {

    saveUserInDB(req.body, res);
});

app.post("/login", formUpload.none(), (req, res) => {
    const { email, password1 } = req.body;

    if (!email || !password1) {
        return res.status(400).send("Email and password are required.");
    }

    const query = "SELECT * FROM user_tbl WHERE email = ?";
    dbConnection.query(query, [email], (err, results) => {
        if (err) return res.status(500).send("Database error.");
        if (results.length === 0) return res.status(401).send("Email not registered.");

        const user = results[0];

        bcrypt.compare(password1, user.password, (err, isMatch) => {
            if (err) return res.status(500).send("Password check failed.");
            if (!isMatch) return res.status(401).send("Incorrect password.");

            // ✅ Store user in session
            req.session.user = {
                id: user.user_id,
                username: user.username,
                email: user.email
            };

            res.status(200).send("Login successful!");
        });
    });
});

app.use((req, res, next) => {
    console.log("Session data:", req.session);
    next();
});

const queryAsync = (sql, params) => {
    return new Promise((resolve, reject) => {
        dbConnection.query(sql, params, (err, results) => {
            if (err) {
                return reject(err);
            }
            resolve(results);
        });
    });
};


app.get("/user/get-history", async (req, res) => {
    try {
        const userId = req.session.user?.id;

        if (!userId) {
            return res.status(401).json({ message: 'Unauthorized' });
        }

        // Query to fetch the user's history entry from the database
        const [history] = await queryAsync("SELECT * FROM user_history_tbl WHERE user_id = ?", [userId]);

        // Check if there's an existing history for the user
        if (history) {
            // Send the history back as JSON response
            res.status(200).json({
                history_save: history.history_save,
                history_datetime: history.history_datetime
            });
        } else {
            // If no history exists, send an empty response
            res.status(200).json({
                history_save: null,
                history_datetime: null
            });
        }
    } catch (error) {
        console.error('Error fetching user history:', error);
        res.status(500).json({ message: 'Internal Server Error' });
    }
});

app.delete('/user/delete-history', async (req, res) => {
    const userId = req.session.user?.id;

    if (!userId) {
        return res.status(401).json({ message: 'Unauthorized' });
    }

    try {
        const sql = 'UPDATE user_history_tbl SET history_save = NULL, history_datetime = NULL WHERE user_id = ?';
        await queryAsync(sql, [userId]);

        res.status(200).json({ message: 'History deleted successfully.' });
    } catch (error) {
        console.error('Error deleting history:', error);
        res.status(500).json({ message: 'Server error' });
        console.log(error); // Log the error for debugging
    }
});

app.put("/user/change-username", async (req, res) => {
    try {
        if (!req.session.user) {
            return res.status(401).send("Unauthorized");
        }

        const userId = req.session.user.id;
        const { newUsername } = req.body;

        if (!newUsername || newUsername.trim() === "") {
            return res.status(400).send("New username is required.");
        }

        const sql = "UPDATE user_tbl SET username = ? WHERE user_id = ?";
        await queryAsync(sql, [newUsername.trim(), userId]);

        // Update the session so the new username is reflected immediately
        req.session.user.username = newUsername.trim();

        res.status(200).send("Username updated successfully.");
    } catch (error) {
        console.error("Error updating username:", error);
        res.status(500).send("Failed to update username.");
    }
});



app.put("/user/change-password", async (req, res) => {
    try {
        if (!req.session.user) {
            return res.status(401).send("Unauthorized");
        }

        const userId = req.session.user.id;
        const { currentPassword, newPassword } = req.body;

        if (!currentPassword || !newPassword) {
            return res
                .status(400)
                .send("Both current and new passwords are required.");
        }

        if (newPassword.length < 8) {
            return res
                .status(400)
                .send("New password must be at least 8 characters.");
        }

        // Fetch the user's current hashed password
        const [user] = await queryAsync(
            "SELECT password FROM user_tbl WHERE user_id = ?",
            [userId]
        );

        if (!user) {
            return res.status(404).send("User not found.");
        }

        // Compare passwords
        const match = await bcrypt.compare(currentPassword, user.password);
        if (!match) {
            return res.status(401).send("Current password is incorrect.");
        }

        // Hash new password
        const hashedPassword = await bcrypt.hash(newPassword, 10);

        await queryAsync(
            "UPDATE user_tbl SET password = ?, password_datetime = NOW() WHERE user_id = ?",
            [hashedPassword, userId]
        );


        res.status(200).send("Password changed successfully.");
    } catch (error) {
        console.error("Error changing password:", error);
        res.status(500).send("Failed to change password.");
    }
});


app.post("/user/delete-account", async (req, res) => {
    try {
        const userId = req.session.user?.id;
        const { confirm, password } = req.body;

        if (!userId) {
            return res.status(401).json({ message: "Unauthorized" });
        }

        if (confirm !== "CONFIRM") {
            return res.status(400).json({ message: 'You must type "CONFIRM" to proceed' });
        }

        const [user] = await queryAsync("SELECT password FROM user_tbl WHERE user_id = ?", [userId]);

        if (!user) {
            return res.status(404).json({ message: "User not found" });
        }

        const passwordMatch = await bcrypt.compare(password, user.password);
        if (!passwordMatch) {
            return res.status(401).json({ message: "Incorrect password" });
        }

        // Delete account (and related history if you want cascade cleanup)
        await queryAsync("DELETE FROM user_tbl WHERE user_id = ?", [userId]);
        await queryAsync("DELETE FROM user_history_tbl WHERE user_id = ?", [userId]);

        req.session.destroy(() => {
            res.status(200).json({ message: "Account deleted successfully" });
        });
    } catch (error) {
        console.error("Error deleting account:", error);
        res.status(500).json({ message: "Internal Server Error" });
    }
});


function saveUserInDB(userData, res) {
    const { username, email, password1 } = userData;

    // Check if the email already exists
    const checkEmailQuery = "SELECT * FROM user_tbl WHERE email = ?";
    dbConnection.query(checkEmailQuery, [email], (err, results) => {
        if (err) {
            console.error(err);
            res.status(500).send("An error occurred while checking the email.");
            return; // Stop further execution
        }

        if (results.length > 0) {
            // Email already exists
            res.status(400).send("Email already exists.");
            return; // Stop further execution
        }

        // If email does not exist, hash the password and insert the user
        bcrypt.hash(password1, 10, (err, hashedPassword) => {
            if (err) {
                console.error(err);
                res.status(500).send("An error occurred while hashing the password.");
                return; // Stop further execution
            }

            const insertQuery = `
                INSERT INTO user_tbl (username, email, password, password_datetime)
                VALUES (?, ?, ?, NOW())
            `;
            dbConnection.query(
                insertQuery,
                [username, email, hashedPassword],
                (err, result) => {
                    if (err) {
                        console.error(err);
                        res.status(500).send("An error occurred while inserting the user.");
                        return;
                    }

                    res.status(200).send("User registered successfully!");
                }
            );
        });
    });
}

// save history

app.post("/user/save-history", async (req, res) => {
    try {
      const { medicineName, details, interactions, guidelines, effects, prices } = req.body;
      const historyArray = [medicineName, details, interactions, guidelines, effects, prices];
      const historySave = JSON.stringify(historyArray);
      const historyDatetime = new Date();
      const userId = req.session.user?.id;
  
      if (!userId) {
        return res.status(401).json({ message: "Unauthorized" });
      }
  
      const existingHistory = await queryAsync("SELECT * FROM user_history_tbl WHERE user_id = ?", [userId]);
  
      if (existingHistory.length > 0) {
        const sqlUpdate = "UPDATE user_history_tbl SET history_save = ?, history_datetime = ? WHERE user_id = ?";
        await queryAsync(sqlUpdate, [historySave, historyDatetime, userId]);
      } else {
        const sqlInsert = "INSERT INTO user_history_tbl (user_id, history_save, history_datetime) VALUES (?, ?, ?)";
        await queryAsync(sqlInsert, [userId, historySave, historyDatetime]);
      }
  
      res.status(200).json({ message: "History saved successfully" });
    } catch (error) {
      console.error("Error saving history:", error);
      res.status(500).json({ message: error.message || "Internal Server Error" });
    }
  });
  

app.get("/user/get-history", async (req, res) => {
    try {
        const userId = req.session.user?.id;

        if (!userId) {
            return res.status(401).json({ message: "Unauthorized" });
        }

        // Query to fetch the user's history entry from the database
        const [history] = await queryAsync(
            "SELECT * FROM user_history_tbl WHERE user_id = ?",
            [userId]
        );

        // Check if there's an existing history for the user
        if (history) {
            // Send the history back as JSON response
            res.status(200).json({
                history_save: history.history_save,
                history_datetime: history.history_datetime,
            });
        } else {
            // If no history exists, send an empty response
            res.status(200).json({
                history_save: null,
                history_datetime: null,
            });
        }
    } catch (error) {
        console.error("Error fetching user history:", error);
        res.status(500).json({ message: "Internal Server Error" });
    }
});


app.delete("/user/delete-history", async (req, res) => {
    const userId = req.session.user?.id;

    if (!userId) {
        return res.status(401).json({ message: "Unauthorized" });
    }

    try {
        const sql =
            "UPDATE user_history_tbl SET history_save = NULL, history_datetime = NULL WHERE user_id = ?";
        await queryAsync(sql, [userId]);

        res.status(200).json({ message: "History deleted successfully." });
    } catch (error) {
        console.error("Error deleting history:", error);
        res.status(500).json({ message: "Server error" });
        console.log(error); // Log the error for debugging
    }
});

app.post("/save-image", async (req, res) => {
    if (!req.session.user) {
        return res.status(401).json({ message: "Unauthorized" });
    }

    const { image } = req.body;

    // ✅ 1. Validate base64 format
    if (!image || !image.startsWith("data:image")) {
        return res.status(400).json({ message: "Invalid image data" });
    }

    // ✅ 2. Extract MIME type from base64 string
    const matches = image.match(/^data:(image\/\w+);base64,/);
    const imageType = matches ? matches[1] : "image/png"; // Default to PNG if regex fails

    // ✅ 3. Decode base64 into buffer
    const imageBuffer = Buffer.from(image.split(",")[1], "base64");

    const userId = req.session.user.id;

    try {
        const updateQuery =
            "UPDATE user_tbl SET image = ?, image_type = ? WHERE user_id = ?";
        dbConnection.query(updateQuery, [imageBuffer, imageType, userId], (err) => {
            if (err) {
                console.error("Error saving image:", err);
                return res.status(500).json({ message: "Error saving image" });
            }

            res.status(200).json({ message: "Image updated successfully" });
        });
    } catch (err) {
        console.error("Error processing image:", err);
        res.status(500).json({ message: "Error processing image" });
    }
}); 

app.get("/guest-recovery", (req, res) => {
    res.render("guest/guest-recovery");
});

const crypto = require("crypto"); // for secure random code generation
const nodemailer = require("nodemailer"); // for sending email (assuming you want to email recovery code)

// Setup your email transporter (use your real SMTP credentials)

const transporter = nodemailer.createTransport({
    service: "Gmail", // Example: Gmail. Change this based on your email provider.
    auth: {
        user: process.env.EMAIL_USER, // your email
        pass: process.env.EMAIL_PASS, // your email app password
    },
});

// --- Recovery Step 1: Request Recovery Code ---
// --- Recovery Step 1: Request Recovery Code ---
app.post("/recovery-request", formUpload.none(), (req, res) => {
    const { email } = req.body;

    if (!email) return res.status(400).json({ error: "Email is required." });

    dbConnection.query(
        "SELECT * FROM user_tbl WHERE email = ?",
        [email],
        (err, results) => {
            if (err) {
                console.error("DB SELECT error:", err);
                return res.status(500).json({ error: "Database error", details: err.message });
            }
            if (results.length === 0) {
                return res.status(400).json({ error: "If the email exists, a code was sent." });
            }

            const code = ("000000" + Math.floor(Math.random() * 999999)).slice(-6); // 6-digit code
            const expires = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes

            const updateQuery =
                "UPDATE user_tbl SET recovery_code = ?, recovery_code_expires = ? WHERE email = ?";
            dbConnection.query(updateQuery, [code, expires, email], (err) => {
                if (err) {
                    console.error("DB UPDATE error:", err);
                    return res.status(500).json({ error: "Failed to save recovery code", details: err.message });
                }

                // Send email
                const mailOptions = {
                    from: process.env.EMAIL_USER,
                    to: email,
                    subject: "Your Recovery Code",
                    text: `Your MedExtract recovery code is: ${code}`,
                };

                transporter.sendMail(mailOptions, (err, info) => {
                    if (err) {
                        console.error("Email sending error:", err);
                        return res.status(500).json({ error: "Failed to send recovery email", details: err.message });
                    }

                    console.log("Recovery email sent:", info.response);
                    res.status(200).json({ message: "If the email exists, a code was sent." });
                });
            });
        }
    );
});

// --- Recovery Step 2: Verify Recovery Code ---
app.post("/recovery-verify", formUpload.none(), (req, res) => {
    const { email, code } = req.body;

    if (!email || !code)
        return res.status(400).send("Email and code are required.");

    dbConnection.query(
        "SELECT * FROM user_tbl WHERE email = ?",
        [email],
        (err, results) => {
            if (err) return res.status(500).send("Database error.");
            if (results.length === 0)
                return res.status(400).send("Invalid email or code.");

            const user = results[0];
            const now = new Date();

            if (user.recovery_code !== code || now > user.recovery_code_expires) {
                return res.status(400).send("Invalid or expired recovery code.");
            }

            // Mark email as validated for password reset (use session)
            req.session.recoveryUser = { email: email };

            res.status(200).send("Code verified. Proceed to change password.");
        }
    );
});

// --- Recovery Step 3: Reset Password ---
app.post("/recovery-reset", formUpload.none(), (req, res) => {
    const { password1 } = req.body;

    if (!req.session.recoveryUser)
        return res
            .status(401)
            .send("Unauthorized. Please verify your recovery code.");
    if (!password1 || password1.length < 8)
        return res.status(400).send("Password must be at least 8 characters.");

    bcrypt.hash(password1, 10, (err, hashedPassword) => {
        if (err) return res.status(500).send("Password hashing failed.");

        const updateQuery =
            "UPDATE user_tbl SET password = ?, recovery_code = NULL, recovery_code_expires = NULL WHERE email = ?";
        dbConnection.query(
            updateQuery,
            [hashedPassword, req.session.recoveryUser.email],
            (err) => {
                if (err) return res.status(500).send("Failed to update password.");

                // Clear session
                req.session.recoveryUser = null;

                res.status(200).send("Password changed successfully!");
            }
        );
    });
});







