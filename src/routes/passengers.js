const express = require("express");
const router = express.Router();
const pool = require("../config/db");
const authMiddleware = require("../middleware/auth");

// GET /passengers/:passenger_id - Retrieve complete passenger profile
router.get("/:passenger_id", authMiddleware, async (req, res) => {
  try {
    const { passenger_id } = req.params;
    // Join with users for verification status and preferences
    const result = await pool.query(
      `SELECT p.*, u.is_verified, u.phone_number, u.created_at
       FROM passengers p
       JOIN users u ON p.user_id = u.user_id
       WHERE p.user_id = $1`,
      [passenger_id]
    );
    if (result.rows.length === 0) {
      return res
        .status(404)
        .json({ success: false, message: "Passenger not found" });
    }
    res.json({ success: true, data: result.rows[0] });
  } catch (err) {
    res
      .status(500)
      .json({ success: false, message: "Server error", error: err.message });
  }
});

// PUT /passengers/:passenger_id - Update passenger profile with validation and change tracking
router.put("/:passenger_id", authMiddleware, async (req, res) => {
  try {
    const { passenger_id } = req.params;
    const { firstName, lastName, email = null } = req.body;
    // Validate fields (add more as needed)
    if (!firstName || !lastName) {
      return res
        .status(400)
        .json({ success: false, message: "First and last name required" });
    }
    // Update profile
    const updateResult = await pool.query(
      `UPDATE passengers SET first_name = $1, last_name = $2, email = $3 WHERE user_id = $4 RETURNING *`,
      [firstName, lastName, email, passenger_id]
    );
    if (updateResult.rows.length === 0) {
      return res
        .status(404)
        .json({ success: false, message: "Passenger not found" });
    }
    // Change tracking (simple example: log to audit table)
    await pool.query(
      `INSERT INTO audit_log (entity, entity_id, change_type, changed_by, change_time) VALUES ('passenger', $1, 'update', $2, NOW())`,
      [passenger_id, req.user.user_id]
    );
    res.json({ success: true, data: updateResult.rows[0] });
  } catch (err) {
    res
      .status(500)
      .json({ success: false, message: "Server error", error: err.message });
  }
});

// GET /passengers/:passenger_id/trips - Paginated trip history with filters
router.get("/:passenger_id/trips", authMiddleware, async (req, res) => {
  try {
    const { passenger_id } = req.params;
    const { status, start_date, end_date, page = 1, limit = 10 } = req.query;
    let query = `SELECT t.*, d.first_name as driver_first_name, d.last_name as driver_last_name, t.fare
                 FROM trips t
                 JOIN drivers d ON t.driver_id = d.user_id
                 WHERE t.passenger_id = $1`;
    const params = [passenger_id];
    if (status) {
      query += ` AND t.status = $${params.length + 1}`;
      params.push(status);
    }
    if (start_date) {
      query += ` AND t.start_time >= $${params.length + 1}`;
      params.push(start_date);
    }
    if (end_date) {
      query += ` AND t.end_time <= $${params.length + 1}`;
      params.push(end_date);
    }
    query += ` ORDER BY t.start_time DESC LIMIT $${params.length + 1} OFFSET $${
      params.length + 2
    }`;
    params.push(limit, (page - 1) * limit);
    const result = await pool.query(query, params);
    res.json({ success: true, data: result.rows });
  } catch (err) {
    res
      .status(500)
      .json({ success: false, message: "Server error", error: err.message });
  }
});

// GET /passengers/:passenger_id/payment-methods - List all payment methods
router.get(
  "/:passenger_id/payment-methods",
  authMiddleware,
  async (req, res) => {
    try {
      const { passenger_id } = req.params;
      const result = await pool.query(
        `SELECT * FROM payment_methods WHERE user_id = $1`,
        [passenger_id]
      );
      res.json({ success: true, data: result.rows });
    } catch (err) {
      res
        .status(500)
        .json({ success: false, message: "Server error", error: err.message });
    }
  }
);

// POST /passengers/:passenger_id/payment-methods - Add new payment method
router.post(
  "/:passenger_id/payment-methods",
  authMiddleware,
  async (req, res) => {
    try {
      const { passenger_id } = req.params;
      const { expiration_date, card_type, last_four_digits, is_default } =
        req.body;

      // Get user_id from passengers table
      const userResult = await pool.query(
        "SELECT user_id FROM passengers WHERE user_id = $1",
        [passenger_id]
      );
      if (userResult.rows.length === 0) {
        return res
          .status(404)
          .json({ success: false, message: "Passenger not found" });
      }
      const user_id = userResult.rows[0].user_id;

      // Insert new payment method
      const result = await pool.query(
        `INSERT INTO payment_methods (user_id, expiration_date, card_type, last_four_digits, is_default)
           VALUES ($1, $2, $3, $4, $5) RETURNING *`,
        [
          user_id,
          expiration_date,
          card_type,
          last_four_digits,
          is_default || false,
        ]
      );
      res.status(201).json({ success: true, data: result.rows[0] });
    } catch (err) {
      res
        .status(500)
        .json({ success: false, message: "Server error", error: err.message });
    }
  }
);

module.exports = router;
