const express = require("express");
const router = express.Router();
const pool = require("../config/db");
const authMiddleware = require("../middleware/auth");

// Helper function to calculate distance between two points (Haversine formula)
function calculateDistance(lat1, lon1, lat2, lon2) {
  const R = 6371; // Earth's radius in kilometers
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

// Helper function to estimate fare based on distance
function estimateFare(distance) {
  const baseFare = 5.0; // Base fare in currency units
  const perKmRate = 2.5; // Rate per kilometer
  return baseFare + distance * perKmRate;
}

// GET /trips/nearby-drivers - Returns available drivers near specified locations
// This must come BEFORE /:trip_id routes to avoid route matching conflicts
router.get("/nearby-drivers", authMiddleware, async (req, res) => {
  try {
    const { latitude, longitude, radius = 5 } = req.query; // radius in km

    if (!latitude || !longitude) {
      return res.status(400).json({
        success: false,
        message: "Latitude and longitude are required",
      });
    }

    // Get available drivers (not currently on a trip)
    const driversResult = await pool.query(
      `SELECT d.user_id, d.license_number, u.phone_number
       FROM drivers d
       JOIN users u ON d.user_id = u.user_id
       WHERE d.user_id NOT IN (
         SELECT DISTINCT driver_id 
         FROM trips 
         WHERE trip_status IN ('accepted', 'started') 
         AND driver_id IS NOT NULL
       )`
    );

    // TODO: In a real application, you would have driver location data
    // For now, we'll return all available drivers with mock distance data
    const nearbyDrivers = driversResult.rows
      .map((driver, index) => {
        // Mock distance calculation (in real app, use actual driver locations)
        const mockDistance = Math.random() * radius + 0.5; // Random distance within radius
        const estimatedArrival = Math.ceil(mockDistance * 2); // Rough estimate: 2 min per km

        return {
          driver_id: driver.user_id,
          license_number: driver.license_number,
          phone_number: driver.phone_number,
          distance_km: parseFloat(mockDistance.toFixed(2)),
          estimated_arrival_minutes: estimatedArrival,
        };
      })
      .filter((driver) => driver.distance_km <= radius)
      .sort((a, b) => a.distance_km - b.distance_km);

    return res.status(200).json({
      success: true,
      data: {
        location: { latitude, longitude },
        search_radius_km: radius,
        available_drivers: nearbyDrivers,
        total_count: nearbyDrivers.length,
      },
    });
  } catch (error) {
    console.error("Get nearby drivers error:", error);
    return res.status(500).json({ success: false, message: "Server error" });
  }
});

// POST /trips - Creates new trip requests
router.post("/", authMiddleware, async (req, res) => {
  try {
    const {
      pickup_location,
      dropoff_location,
      pickup_lat,
      pickup_lon,
      dropoff_lat,
      dropoff_lon,
    } = req.body;

    if (!pickup_location || !dropoff_location) {
      return res.status(400).json({
        success: false,
        message: "Pickup and dropoff locations are required",
      });
    }

    // Get passenger_id from the authenticated user
    const passengerResult = await pool.query(
      "SELECT user_id FROM passengers WHERE user_id = $1",
      [req.user.user_id]
    );
    console.log(passengerResult.rows);
    if (passengerResult.rows.length === 0) {
      return res.status(403).json({
        success: false,
        message: "Only passengers can create trip requests",
      });
    }

    const passenger_id = passengerResult.rows[0].user_id;

    // Calculate distance if coordinates are provided
    let distance = null;
    if (pickup_lat && pickup_lon && dropoff_lat && dropoff_lon) {
      distance = calculateDistance(
        pickup_lat,
        pickup_lon,
        dropoff_lat,
        dropoff_lon
      );
    }

    // Estimate fare
    const estimatedFare = distance ? estimateFare(distance) : 15.0; // Default fare if no distance

    // Create trip request
    const tripResult = await pool.query(
      `INSERT INTO trips 
       (passenger_id, pickup_location, dropoff_location, fare, distance, trip_status) 
       VALUES ($1, $2, $3, $4, $5, 'requested') 
       RETURNING *`,
      [passenger_id, pickup_location, dropoff_location, estimatedFare, distance]
    );

    const trip = tripResult.rows[0];

    return res.status(201).json({
      success: true,
      message: "Trip request created successfully",
      data: {
        trip_id: trip.trip_id,
        pickup_location: trip.pickup_location,
        dropoff_location: trip.dropoff_location,
        estimated_fare: trip.fare,
        distance: trip.distance,
        status: trip.trip_status,
      },
    });
  } catch (error) {
    console.error("Create trip error:", error);
    return res.status(500).json({ success: false, message: "Server error" });
  }
});

// GET /trips/{trip_id} - Retrieves detailed trip information
router.get("/:trip_id", authMiddleware, async (req, res) => {
  try {
    const { trip_id } = req.params;

    const tripResult = await pool.query(
      `SELECT t.*, 
              p.first_name as passenger_first_name, p.last_name as passenger_last_name,
              d.license_number as driver_license
       FROM trips t
       LEFT JOIN passengers p ON t.passenger_id = p.user_id
       LEFT JOIN drivers d ON t.driver_id = d.user_id
       WHERE t.trip_id = $1`,
      [trip_id]
    );

    if (tripResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Trip not found",
      });
    }

    const trip = tripResult.rows[0];

    // Check if user is authorized to view this trip
    if (
      trip.passenger_id !== req.user.user_id &&
      trip.driver_id !== req.user.user_id
    ) {
      return res.status(403).json({
        success: false,
        message: "Not authorized to view this trip",
      });
    }

    return res.status(200).json({
      success: true,
      data: {
        trip_id: trip.trip_id,
        passenger: {
          id: trip.passenger_id,
          name: `${trip.passenger_first_name} ${trip.passenger_last_name}`,
        },
        driver: trip.driver_id
          ? {
              id: trip.driver_id,
              license: trip.driver_license,
            }
          : null,
        pickup_location: trip.pickup_location,
        dropoff_location: trip.dropoff_location,
        start_time: trip.start_time,
        end_time: trip.end_time,
        fare: trip.fare,
        distance: trip.distance,
        duration: trip.duration,
        status: trip.trip_status,
      },
    });
  } catch (error) {
    console.error("Get trip error:", error);
    return res.status(500).json({ success: false, message: "Server error" });
  }
});

// PUT /trips/{trip_id}/accept - Allows drivers to accept trip requests
router.put("/:trip_id/accept", authMiddleware, async (req, res) => {
  try {
    const { trip_id } = req.params;

    // Check if user is a driver
    const driverResult = await pool.query(
      "SELECT user_id FROM drivers WHERE user_id = $1",
      [req.user.user_id]
    );

    if (driverResult.rows.length === 0) {
      return res.status(403).json({
        success: false,
        message: "Only drivers can accept trip requests",
      });
    }

    const driver_id = driverResult.rows[0].user_id;

    // Get trip details
    const tripResult = await pool.query(
      "SELECT * FROM trips WHERE trip_id = $1",
      [trip_id]
    );

    if (tripResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Trip not found",
      });
    }

    const trip = tripResult.rows[0];

    if (trip.trip_status !== "requested") {
      return res.status(400).json({
        success: false,
        message: "Trip is not available for acceptance",
      });
    }

    // Check if driver is already assigned to another active trip
    const activeTripResult = await pool.query(
      "SELECT * FROM trips WHERE driver_id = $1 AND trip_status IN ('accepted', 'started')",
      [driver_id]
    );

    if (activeTripResult.rows.length > 0) {
      return res.status(400).json({
        success: false,
        message: "Driver is already assigned to an active trip",
      });
    }

    // Accept the trip
    await pool.query(
      "UPDATE trips SET driver_id = $1, trip_status = 'accepted' WHERE trip_id = $2",
      [driver_id, trip_id]
    );

    return res.status(200).json({
      success: true,
      message: "Trip accepted successfully",
    });
  } catch (error) {
    console.error("Accept trip error:", error);
    return res.status(500).json({ success: false, message: "Server error" });
  }
});

// PUT /trips/{trip_id}/start - Marks trip start
router.put("/:trip_id/start", authMiddleware, async (req, res) => {
  try {
    const { trip_id } = req.params;

    // Get trip details
    const tripResult = await pool.query(
      "SELECT * FROM trips WHERE trip_id = $1",
      [trip_id]
    );

    if (tripResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Trip not found",
      });
    }

    const trip = tripResult.rows[0];

    // Check if user is the assigned driver
    if (trip.driver_id !== req.user.user_id) {
      return res.status(403).json({
        success: false,
        message: "Only the assigned driver can start the trip",
      });
    }

    if (trip.trip_status !== "accepted") {
      return res.status(400).json({
        success: false,
        message: "Trip must be accepted before it can be started",
      });
    }

    // Start the trip
    await pool.query(
      "UPDATE trips SET trip_status = 'started', start_time = NOW() WHERE trip_id = $1",
      [trip_id]
    );

    return res.status(200).json({
      success: true,
      message: "Trip started successfully",
    });
  } catch (error) {
    console.error("Start trip error:", error);
    return res.status(500).json({ success: false, message: "Server error" });
  }
});

// PUT /trips/{trip_id}/complete - Completes trips
router.put("/:trip_id/complete", authMiddleware, async (req, res) => {
  try {
    const { trip_id } = req.params;
    const { actual_distance, actual_fare } = req.body;

    // Get trip details
    const tripResult = await pool.query(
      "SELECT * FROM trips WHERE trip_id = $1",
      [trip_id]
    );

    if (tripResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Trip not found",
      });
    }

    const trip = tripResult.rows[0];

    // Check if user is the assigned driver
    if (trip.driver_id !== req.user.user_id) {
      return res.status(403).json({
        success: false,
        message: "Only the assigned driver can complete the trip",
      });
    }

    if (trip.trip_status !== "started") {
      return res.status(400).json({
        success: false,
        message: "Trip must be started before it can be completed",
      });
    }

    // Calculate final values
    const finalDistance = actual_distance || trip.distance;
    const finalFare = actual_fare || trip.fare;

    // Complete the trip
    await pool.query(
      `UPDATE trips 
       SET trip_status = 'completed', 
           end_time = NOW(), 
           duration = NOW() - start_time,
           distance = $1,
           fare = $2
       WHERE trip_id = $3`,
      [finalDistance, finalFare, trip_id]
    );

    // TODO: Implement payment processing here
    // TODO: Implement points deduction here

    return res.status(200).json({
      success: true,
      message: "Trip completed successfully",
      data: {
        final_fare: finalFare,
        final_distance: finalDistance,
      },
    });
  } catch (error) {
    console.error("Complete trip error:", error);
    return res.status(500).json({ success: false, message: "Server error" });
  }
});

// PUT /trips/{trip_id}/cancel - Handles trip cancellations
router.put("/:trip_id/cancel", authMiddleware, async (req, res) => {
  try {
    const { trip_id } = req.params;
    const { reason } = req.body;

    // Get trip details
    const tripResult = await pool.query(
      "SELECT * FROM trips WHERE trip_id = $1",
      [trip_id]
    );

    if (tripResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Trip not found",
      });
    }

    const trip = tripResult.rows[0];

    // Check if user is authorized to cancel (passenger or assigned driver)
    if (
      trip.passenger_id !== req.user.user_id &&
      trip.driver_id !== req.user.user_id
    ) {
      return res.status(403).json({
        success: false,
        message: "Not authorized to cancel this trip",
      });
    }

    if (trip.trip_status === "completed" || trip.trip_status === "cancelled") {
      return res.status(400).json({
        success: false,
        message: "Trip cannot be cancelled in its current status",
      });
    }

    // Cancel the trip
    await pool.query(
      "UPDATE trips SET trip_status = 'cancelled' WHERE trip_id = $1",
      [trip_id]
    );

    // TODO: Implement refund processing if payment was made
    // TODO: Implement cancellation fee logic

    return res.status(200).json({
      success: true,
      message: "Trip cancelled successfully",
      data: {
        cancellation_reason: reason,
      },
    });
  } catch (error) {
    console.error("Cancel trip error:", error);
    return res.status(500).json({ success: false, message: "Server error" });
  }
});

module.exports = router;
