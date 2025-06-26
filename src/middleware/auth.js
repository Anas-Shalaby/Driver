const jwt = require("jsonwebtoken");
const pool = require("../config/db");
require("dotenv").config();

const JWT_SECRET = process.env.JWT_SECRET;

const authMiddleware = async (req, res, next) => {
  const authHeader = req.headers["authorization"];
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res
      .status(401)
      .json({ success: false, message: "No token provided" });
  }
  const token = authHeader.split(" ")[1];
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    // Check if user is verified
    const userResult = await pool.query(
      "SELECT * FROM users WHERE user_id = $1",
      [decoded.userId]
    );
    if (userResult.rows.length === 0) {
      return res
        .status(401)
        .json({ success: false, message: "User not found" });
    }
    const user = userResult.rows[0];
    if (!user.is_verified) {
      return res
        .status(403)
        .json({ success: false, message: "User not verified" });
    }
    req.user = user;
    next();
  } catch (err) {
    return res.status(401).json({
      success: false,
      message: "Invalid or expired token",
      error: err.message,
    });
  }
};

module.exports = authMiddleware;
