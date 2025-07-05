const pool = require("../config/db");

/**
 * Retrieves comprehensive driver profile.
 * - Joins users, drivers, and vehicles tables.
 * - Returns personal info, vehicle details, status, and performance metrics.
 */
exports.getDriverProfile = async (req, res) => {
  try {
    const driver_id = req.user.user_id;

    // Validate driver_id is integer
    if (isNaN(driver_id)) {
      return res
        .status(400)
        .json({ success: false, message: "Invalid driver_id" });
    }

    // Query driver with joined user and vehicle info
    const query = `
  SELECT 
    d.user_id,
    d.license_number,
    d.driver_status,
    d.current_location,
    d.rating,
    d.points_balance,
    d.first_name,
    d.last_name,
    u.phone_number,
    v.vehicle_id,
    v.make,
    v.model,
    v.year,
    v.license_plate,
    v.color,
    v.capacity
  FROM drivers d
  JOIN users u ON d.user_id = u.user_id
  LEFT JOIN vehicles v ON v.driver_id = d.user_id
  WHERE d.user_id = $1
`;
    const result = await pool.query(query, [driver_id]);
    if (result.rows.length === 0) {
      return res
        .status(404)
        .json({ success: false, message: "Driver not found" });
    }

    // Return driver profile
    return res.status(200).json({
      success: true,
      data: result.rows[0],
    });
  } catch (error) {
    console.error("Get driver profile error:", error);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

/**
 * Updates driver profile information with validation for driver-specific fields.
 * Only allows updating first_name, last_name, license_number, driver_status, current_location, and rating.
 * If vehicle info is present in the body, update the vehicle as well.
 */
exports.updateDriverProfile = async (req, res) => {
  try {
    const driver_id = req.user.user_id;
    const {
      first_name,
      last_name,
      license_number,
      driver_status,
      current_location,
      rating,
      // Vehicle fields (optional)
      vehicle,
    } = req.body;

    // Validate driver_id
    if (isNaN(driver_id)) {
      return res
        .status(400)
        .json({ success: false, message: "Invalid driver_id" });
    }

    // Validate at least one field to update
    if (
      !first_name &&
      !last_name &&
      !license_number &&
      !driver_status &&
      !current_location &&
      !rating &&
      !vehicle
    ) {
      return res
        .status(400)
        .json({ success: false, message: "No fields to update" });
    }

    // Build dynamic update query for drivers
    const fields = [];
    const values = [];
    let idx = 1;
    if (first_name) {
      fields.push(`first_name = $${idx++}`);
      values.push(first_name);
    }
    if (last_name) {
      fields.push(`last_name = $${idx++}`);
      values.push(last_name);
    }
    if (license_number) {
      fields.push(`license_number = $${idx++}`);
      values.push(license_number);
    }
    if (driver_status) {
      fields.push(`driver_status = $${idx++}`);
      values.push(driver_status);
    }
    if (current_location) {
      fields.push(`current_location = $${idx++}`);
      values.push(current_location);
    }
    if (rating) {
      fields.push(`rating = $${idx++}`);
      values.push(rating);
    }

    let driverUpdateResult;
    if (fields.length > 0) {
      const updateQuery = `UPDATE drivers SET ${fields.join(
        ", "
      )} WHERE user_id = $${idx} RETURNING *`;
      values.push(driver_id);
      driverUpdateResult = await pool.query(updateQuery, values);
      if (driverUpdateResult.rows.length === 0) {
        return res
          .status(404)
          .json({ success: false, message: "Driver not found" });
      }
    }

    // If vehicle info is present, update vehicle
    let vehicleUpdateResult;
    if (vehicle && typeof vehicle === "object") {
      // Only allow updating allowed vehicle fields
      const allowedVehicleFields = [
        "make",
        "model",
        "year",
        "license_plate",
        "color",
        "capacity",
      ];
      const vehicleFields = [];
      const vehicleValues = [];
      let vIdx = 1;
      for (const key of allowedVehicleFields) {
        if (vehicle[key]) {
          vehicleFields.push(`${key} = $${vIdx++}`);
          vehicleValues.push(vehicle[key]);
        }
      }
      if (vehicleFields.length > 0) {
        // Find the driver's vehicle_id
        const vehicleIdResult = await pool.query(
          "SELECT vehicle_id FROM vehicles WHERE driver_id = $1",
          [driver_id]
        );
        if (vehicleIdResult.rows.length === 0) {
          return res.status(404).json({
            success: false,
            message: "Vehicle not found for this driver",
          });
        }
        const vehicle_id = vehicleIdResult.rows[0].vehicle_id;
        const vehicleUpdateQuery = `UPDATE vehicles SET ${vehicleFields.join(
          ", "
        )} WHERE vehicle_id = $${vIdx} RETURNING *`;
        vehicleValues.push(vehicle_id);
        vehicleUpdateResult = await pool.query(
          vehicleUpdateQuery,
          vehicleValues
        );
      }
    }

    return res.status(200).json({
      success: true,
      message: "Driver profile updated successfully",
      driver: driverUpdateResult ? driverUpdateResult.rows[0] : undefined,
      vehicle: vehicleUpdateResult ? vehicleUpdateResult.rows[0] : undefined,
    });
  } catch (error) {
    console.error("Update driver profile error:", error);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

/**
 * Allows authenticated driver to add their vehicle.
 * Validates input, ensures driver does not already have a vehicle, inserts new vehicle, and links it to the driver.
 */
exports.addDriverVehicle = async (req, res) => {
  try {
    const driver_id = req.user.user_id;
    const { make, model, year, license_plate, color, capacity } = req.body;

    // Validate required fields
    if (!make || !model || !year || !license_plate || !color || !capacity) {
      return res
        .status(400)
        .json({ success: false, message: "All vehicle fields are required" });
    }

    // Check if driver already has a vehicle
    const existingVehicle = await pool.query(
      "SELECT vehicle_id FROM vehicles WHERE driver_id = $1",
      [driver_id]
    );
    if (existingVehicle.rows.length > 0) {
      return res
        .status(400)
        .json({ success: false, message: "Driver already has a vehicle" });
    }

    // Insert new vehicle
    const insertQuery = `
      INSERT INTO vehicles (driver_id, make, model, year, license_plate, color, capacity)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING *
    `;
    const insertResult = await pool.query(insertQuery, [
      driver_id,
      make,
      model,
      year,
      license_plate,
      color,
      capacity,
    ]);
    const vehicle = insertResult.rows[0];

    // Optionally, update driver's vehicle_id (if you want to keep this link)
    await pool.query("UPDATE drivers SET vehicle_id = $1 WHERE user_id = $2", [
      vehicle.vehicle_id,
      driver_id,
    ]);

    return res.status(201).json({
      success: true,
      message: "Vehicle added successfully",
      vehicle,
    });
  } catch (error) {
    console.error("Add driver vehicle error:", error);
    if (error.code === "23505") {
      // unique_violation
      return res
        .status(400)
        .json({ success: false, message: "License plate already exists" });
    }
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

/**
 * Updates driver's current location with timestamp and accuracy.
 * Validates input, checks for suspicious jumps (fraud detection), and updates the database.
 */
exports.updateDriverLocation = async (req, res) => {
  try {
    const driver_id = req.user.user_id;
    const { latitude, longitude, accuracy } = req.body;

    // Basic validation
    if (
      typeof latitude !== "number" ||
      typeof longitude !== "number" ||
      typeof accuracy !== "number"
    ) {
      return res.status(400).json({
        success: false,
        message:
          "latitude, longitude, and accuracy are required and must be numbers",
      });
    }
    if (accuracy > 100) {
      // Only accept locations with <100m accuracy
      return res
        .status(400)
        .json({ success: false, message: "Location accuracy too low" });
    }

    // Fetch last known location for fraud detection
    const lastLocRes = await pool.query(
      "SELECT current_location, last_location_update FROM drivers WHERE user_id = $1",
      [driver_id]
    );
    if (lastLocRes.rows.length === 0) {
      return res
        .status(404)
        .json({ success: false, message: "Driver not found" });
    }

    let suspicious = false;
    const now = new Date();
    if (lastLocRes.rows[0].current_location) {
      const [lastLat, lastLng] = lastLocRes.rows[0].current_location
        .split(",")
        .map(Number);
      const lastTime = lastLocRes.rows[0].last_location_update
        ? new Date(lastLocRes.rows[0].last_location_update)
        : null;
      // Calculate distance (Haversine formula)
      const toRad = (v) => (v * Math.PI) / 180;
      const R = 6371e3; // meters
      const dLat = toRad(latitude - lastLat);
      const dLng = toRad(longitude - lastLng);
      const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(toRad(lastLat)) *
          Math.cos(toRad(latitude)) *
          Math.sin(dLng / 2) *
          Math.sin(dLng / 2);
      const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
      const distance = R * c; // meters

      // If last update was less than 1 minute ago and distance > 2km, flag as suspicious
      if (lastTime && now - lastTime < 60 * 1000 && distance > 2000) {
        suspicious = true;
      }
    }

    // Update location and timestamp
    await pool.query(
      "UPDATE drivers SET current_location = $1, last_location_update = $2 WHERE user_id = $3",
      [`${latitude},${longitude}`, now, driver_id]
    );

    return res.status(200).json({
      success: true,
      message: "Location updated",
      suspicious,
      timestamp: now,
    });
  } catch (error) {
    console.error("Update driver location error:", error);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

/**
 * Changes driver availability status with appropriate validation and business rule enforcement.
 * Only allows valid statuses and checks for business constraints (e.g., cannot go offline during an active trip).
 */
exports.updateDriverStatus = async (req, res) => {
  try {
    const driver_id = req.user.user_id;
    const { status } = req.body;

    // Define allowed statuses
    const allowedStatuses = ["online", "offline", "busy", "away"];
    if (!status || !allowedStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        message: `Status must be one of: ${allowedStatuses.join(", ")}`,
      });
    }

    // Example business rule: cannot go offline if on an active trip
    if (status === "offline") {
      const activeTrip = await pool.query(
        "SELECT trip_id FROM trips WHERE driver_id = $1 AND status = 'active'",
        [driver_id]
      );
      if (activeTrip.rows.length > 0) {
        return res.status(400).json({
          success: false,
          message: "Cannot go offline while on an active trip",
        });
      }
    }

    // Update driver status
    const updateRes = await pool.query(
      "UPDATE drivers SET driver_status = $1 WHERE user_id = $2 RETURNING driver_status",
      [status, driver_id]
    );
    if (updateRes.rows.length === 0) {
      return res
        .status(404)
        .json({ success: false, message: "Driver not found" });
    }

    return res.status(200).json({
      success: true,
      message: "Driver status updated successfully",
      driver_status: updateRes.rows[0].driver_status,
    });
  } catch (error) {
    console.error("Update driver status error:", error);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

/**
 * Returns driver's trip history with earnings information, passenger ratings, and performance metrics.
 */
exports.getDriverTrips = async (req, res) => {
  try {
    const driver_id = req.user.user_id;

    // Query trips for this driver, joining passengers and aggregating ratings/earnings
    const tripsQuery = `
  SELECT 
    t.trip_id,
    t.start_time,
    t.end_time,
    t.trip_status,
    t.fare,
    t.distance,
    t.duration,
    t.passenger_id,
    p.first_name AS passenger_first_name,
    p.last_name AS passenger_last_name,
    r.score AS passenger_rating,
    r.comment AS passenger_feedback
  FROM trips t
  LEFT JOIN passengers p ON t.passenger_id = p.user_id
  LEFT JOIN ratings r ON r.trip_id = t.trip_id AND r.rated_user_id = $1
  WHERE t.driver_id = $1
  ORDER BY t.start_time DESC
  LIMIT 100
`;
    const tripsResult = await pool.query(tripsQuery, [driver_id]);
    const trips = tripsResult.rows;

    // Aggregate performance metrics
    let totalEarnings = 0,
      totalTrips = 0,
      avgRating = null,
      ratings = [];
    trips.forEach((trip) => {
      totalEarnings += Number(trip.fare || 0);
      totalTrips += 1;
      if (trip.passenger_rating !== null)
        ratings.push(Number(trip.passenger_rating));
    });
    if (ratings.length > 0) {
      avgRating = ratings.reduce((a, b) => a + b, 0) / ratings.length;
      avgRating = Math.round(avgRating * 100) / 100;
    }

    return res.status(200).json({
      success: true,
      trips,
      metrics: {
        totalEarnings,
        totalTrips,
        avgRating,
      },
    });
  } catch (error) {
    console.error("Get driver trips error:", error);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

/**
 * Retrieves current vehicle information including registration details, capacity, and features.
 */
exports.getDriverVehicle = async (req, res) => {
  try {
    const driver_id = req.user.user_id;

    // Query for the driver's vehicle
    const vehicleQuery = `
      SELECT 
        v.vehicle_id,
        v.make,
        v.model,
        v.year,
        v.license_plate,
        v.color,
        v.capacity
      FROM vehicles v
      WHERE v.driver_id = $1
      LIMIT 1
    `;
    const vehicleResult = await pool.query(vehicleQuery, [driver_id]);
    if (vehicleResult.rows.length === 0) {
      return res
        .status(404)
        .json({ success: false, message: "Vehicle not found for this driver" });
    }
    return res.status(200).json({
      success: true,
      vehicle: vehicleResult.rows[0],
    });
  } catch (error) {
    console.error("Get driver vehicle error:", error);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

/**
 * Returns current points balance and transaction history with filtering and pagination options.
 * Assumes a points_transactions table exists with columns: transaction_id, driver_id, amount, type, description, created_at.
 * Supports optional query params: type, start_date, end_date, page, pageSize.
 */
exports.getDriverPoints = async (req, res) => {
  try {
    const driver_id = req.user.user_id;
    const { type, start_date, end_date, page = 1, pageSize = 20 } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(pageSize);

    // Get current points balance
    const balanceRes = await pool.query(
      "SELECT points_balance FROM drivers WHERE user_id = $1",
      [driver_id]
    );
    if (balanceRes.rows.length === 0) {
      return res
        .status(404)
        .json({ success: false, message: "Driver not found" });
    }
    const points_balance = balanceRes.rows[0].points_balance;

    // Build transaction history query
    let txQuery = `
    SELECT 
      transaction_id, 
      amount, 
      transaction_type AS type, 
      transaction_date AS created_at, 
      trip_id
    FROM transactions 
    WHERE driver_id = $1
  `;
    const params = [driver_id];
    let idx = 2;
    if (type) {
      txQuery += ` AND transaction_type = $${idx++}`;
      params.push(type);
    }
    if (start_date) {
      txQuery += ` AND transaction_date >= $${idx++}`;
      params.push(start_date);
    }
    if (end_date) {
      txQuery += ` AND transaction_date <= $${idx++}`;
      params.push(end_date);
    }
    txQuery += ` ORDER BY transaction_date DESC LIMIT $${idx++} OFFSET $${idx}`;
    params.push(pageSize, offset);

    const txRes = await pool.query(txQuery, params);

    return res.status(200).json({
      success: true,
      points_balance,
      transactions: txRes.rows,
      pagination: {
        page: parseInt(page),
        pageSize: parseInt(pageSize),
        count: txRes.rows.length,
      },
    });
  } catch (error) {
    console.error("Get driver points error:", error);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};
