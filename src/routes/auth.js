const express = require("express");
const router = express.Router();
const pool = require("../config/db");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const dotenv = require("dotenv");
const authMiddleware = require("../middleware/auth");
dotenv.config();

const JWT_SECRET = process.env.JWT_SECRET;

// Register endpoint (with userType)
router.post("/register", async (req, res) => {
  try {
    const {
      phoneNumber,
      password,
      userType,
      firstName,
      lastName,
      email,
      licenseNumber,
      companyName,
      contactPerson,
    } = req.body;
    if (!phoneNumber || !password || !userType) {
      return res.status(400).json({
        success: false,
        message: "Phone number, password, and userType are required",
      });
    }
    // Check if user exists
    const userCheck = await pool.query(
      "SELECT * FROM users WHERE phone_number = $1",
      [phoneNumber]
    );
    if (userCheck.rows.length > 0) {
      return res
        .status(400)
        .json({ success: false, message: "User already exists" });
    }
    // Hash password
    const passwordHash = await bcrypt.hash(password, 10);
    // Create user
    const userResult = await pool.query(
      "INSERT INTO users (phone_number, password_hash) VALUES ($1, $2) RETURNING user_id",
      [phoneNumber, passwordHash]
    );
    const userId = userResult.rows[0].user_id;
    // Insert into the appropriate table
    if (userType === "passenger") {
      if (!firstName || !lastName) {
        return res.status(400).json({
          success: false,
          message: "First name and last name are required for passengers",
        });
      }
      await pool.query(
        "INSERT INTO passengers (user_id, first_name, last_name, email) VALUES ($1, $2, $3, $4)",
        [userId, firstName, lastName, email || null]
      );
    } else if (userType === "driver") {
      if (!licenseNumber) {
        return res.status(400).json({
          success: false,
          message: "License number is required for drivers",
        });
      }
      await pool.query(
        "INSERT INTO drivers (user_id, license_number) VALUES ($1, $2)",
        [userId, licenseNumber]
      );
    } else if (userType === "buyer") {
      if (!companyName || !contactPerson || !email) {
        return res.status(400).json({
          success: false,
          message:
            "Company name, contact person, and email are required for buyers",
        });
      }
      await pool.query(
        "INSERT INTO buyers (user_id, company_name, contact_person, email) VALUES ($1, $2, $3, $4)",
        [userId, companyName, contactPerson, email]
      );
    } else {
      return res.status(400).json({
        success: false,
        message: "Invalid userType. Must be 'passenger', 'driver', or 'buyer'",
      });
    }
    return res
      .status(201)
      .json({ success: true, message: "User registered successfully", userId });
  } catch (error) {
    console.error("Register error:", error);
    return res.status(500).json({ success: false, message: "Server error" });
  }
});

// Login (send OTP) endpoint
router.post("/login", async (req, res) => {
  try {
    const { phoneNumber } = req.body;
    if (!phoneNumber) {
      return res
        .status(400)
        .json({ success: false, message: "Phone number is required" });
    }
    // Check if user exists
    const userCheck = await pool.query(
      "SELECT * FROM users WHERE phone_number = $1",
      [phoneNumber]
    );
    if (userCheck.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "User not found. Please register first.",
      });
    }
    // Generate OTP
    const OTP = Math.floor(100000 + Math.random() * 900000).toString();
    const expirationDate = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes
    // Store OTP
    await pool.query(
      "INSERT INTO otp (phone_number, otp, expiration_date) VALUES ($1, $2, $3)",
      [phoneNumber, OTP, expirationDate]
    );
    // (Optional) send OTP via SMS here
    console.log(`Generated OTP for ${phoneNumber}: ${OTP}`);
    return res
      .status(200)
      .json({ success: true, message: "OTP sent to your phone", mockOTP: OTP });
  } catch (error) {
    console.error("Login/OTP error:", error);
    return res.status(500).json({ success: false, message: "Server error" });
  }
});

// Verify OTP endpoint (with JWT generation)
router.post("/verify-phone", async (req, res) => {
  try {
    const { phoneNumber, otp } = req.body;
    if (!phoneNumber || !otp) {
      return res
        .status(400)
        .json({ success: false, message: "Phone number and OTP are required" });
    }
    // Get latest OTP for this phone
    const otpResult = await pool.query(
      "SELECT * FROM otp WHERE phone_number = $1 ORDER BY expiration_date DESC LIMIT 1",
      [phoneNumber]
    );
    if (otpResult.rows.length === 0) {
      return res
        .status(400)
        .json({ success: false, message: "No OTP found. Please login again." });
    }
    const otpRow = otpResult.rows[0];
    if (otpRow.otp !== otp) {
      return res.status(400).json({ success: false, message: "Invalid OTP" });
    }
    if (new Date() > new Date(otpRow.expiration_date)) {
      return res.status(400).json({ success: false, message: "OTP expired" });
    }
    // Mark user as verified
    await pool.query(
      "UPDATE users SET is_verified = TRUE WHERE phone_number = $1",
      [phoneNumber]
    );
    // (Optional) delete OTP after use
    await pool.query("DELETE FROM otp WHERE phone_number = $1", [phoneNumber]);
    // Get user id
    const userResult = await pool.query(
      "SELECT * FROM users WHERE phone_number = $1",
      [phoneNumber]
    );
    const user = userResult.rows[0];
    // Generate JWT
    const token = jwt.sign(
      {
        userId: user.user_id,
        phoneNumber: user.phone_number,
        is_verified: true,
      },
      JWT_SECRET,
      { expiresIn: "7d" }
    );
    return res.status(200).json({
      success: true,
      message: "Phone number verified successfully",
      token,
    });
  } catch (error) {
    console.error("OTP verification error:", error);
    return res.status(500).json({ success: false, message: "Server error" });
  }
});

router.post("/logout", authMiddleware, async (req, res) => {
  try {
    return res
      .status(200)
      .json({ success: true, message: "Logout successful" });
  } catch (error) {
    console.error("Logout error:", error);
    return res.status(500).json({ success: false, message: "Server error" });
  }
});

// Protected route example
router.get("/me", authMiddleware, async (req, res) => {
  res.status(200).json({
    success: true,
    data: {
      user_id: req.user.user_id,
      phone_number: req.user.phone_number,
      is_verified: req.user.is_verified,
    },
  });
});

module.exports = router;
