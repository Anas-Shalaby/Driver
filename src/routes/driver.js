const express = require("express");
const router = express.Router();
const authMiddleware = require("../middleware/auth");
const driverController = require("../controllers/driverController");

/**
 * @route   GET /drivers/:driver_id
 * @desc    Retrieves comprehensive driver profile including personal info, vehicle details, status, and performance metrics.
 * @access  Protected (Driver/Admin)
 */
router.get("/me", authMiddleware, driverController.getDriverProfile);

/**
 * @route   PUT /drivers/:driver_id
 * @desc    Updates driver profile with validation for driver-specific fields.
 * @access  Protected (Driver)
 */
router.put("/me", authMiddleware, driverController.updateDriverProfile);

/**
 * @route   POST /drivers/me/vehicle
 * @desc    Allows authenticated driver to add their vehicle.
 * @access  Protected (Driver)
 */
router.post("/me/vehicle", authMiddleware, driverController.addDriverVehicle);

/**
 * @route   PUT /drivers/me/location
 * @desc    Updates driver's current location with timestamp and accuracy. Includes validation and fraud detection.
 * @access  Protected (Driver)
 */
router.put(
  "/me/location",
  authMiddleware,
  driverController.updateDriverLocation
);

/**
 * @route   PUT /drivers/me/status
 * @desc    Changes driver availability status with appropriate validation and business rule enforcement.
 * @access  Protected (Driver)
 */
router.put("/me/status", authMiddleware, driverController.updateDriverStatus);

/**
 * @route   GET /drivers/me/trips
 * @desc    Returns driver's trip history with earnings information, passenger ratings, and performance metrics.
 * @access  Protected (Driver)
 */
router.get("/me/trips", authMiddleware, driverController.getDriverTrips);

/**
 * @route   GET /drivers/me/vehicle
 * @desc    Retrieves current vehicle information including registration details, capacity, and features.
 * @access  Protected (Driver)
 */
router.get("/me/vehicle", authMiddleware, driverController.getDriverVehicle);

/**
 * @route   GET /drivers/me/points
 * @desc    Returns current points balance and transaction history with filtering and pagination options.
 * @access  Protected (Driver)
 */
router.get("/me/points", authMiddleware, driverController.getDriverPoints);

module.exports = router;
