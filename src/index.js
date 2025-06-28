const express = require("express");
const dotenv = require("dotenv");
// Load environment variables
dotenv.config();

// Import routes
const authRoutes = require("./routes/auth");
const passengersRoutes = require("./routes/passengers");
const tripsRoutes = require("./routes/trips");

const app = express();
const port = process.env.PORT || 3000;

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Basic route
app.get("/", (req, res) => {
  res.json({ message: "Welcome to the Node.js Starter Project!" });
});

// Routes
app.use("/api/v1/auth", authRoutes);
app.use("/api/v1/passengers", passengersRoutes);
app.use("/api/v1/trips", tripsRoutes);

// Start server
app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});
