# Trips API Documentation

This document describes the trip-related endpoints for the ride-sharing application.

## Base URL

```
/api/v1/trips
```

## Authentication

All endpoints require authentication via JWT token in the Authorization header:

```
Authorization: Bearer <your-jwt-token>
```

## Endpoints

### 1. Create Trip Request

**POST** `/trips`

Creates a new trip request with pickup and destination validation, fare estimation, and driver matching initiation.

**Request Body:**

```json
{
  "pickup_location": "123 Main St, City",
  "dropoff_location": "456 Oak Ave, City",
  "pickup_lat": 40.7128,
  "pickup_lon": -74.006,
  "dropoff_lat": 40.7589,
  "dropoff_lon": -73.9851
}
```

**Response:**

```json
{
  "success": true,
  "message": "Trip request created successfully",
  "data": {
    "trip_id": 1,
    "pickup_location": "123 Main St, City",
    "dropoff_location": "456 Oak Ave, City",
    "estimated_fare": 25.5,
    "distance": 5.2,
    "status": "requested"
  }
}
```

### 2. Get Trip Details

**GET** `/trips/{trip_id}`

Retrieves detailed trip information including current status, participant details, and real-time updates.

**Response:**

```json
{
  "success": true,
  "data": {
    "trip_id": 1,
    "passenger": {
      "id": 123,
      "name": "John Doe"
    },
    "driver": {
      "id": 456,
      "license": "DL123456"
    },
    "pickup_location": "123 Main St, City",
    "dropoff_location": "456 Oak Ave, City",
    "start_time": "2024-01-15T10:30:00Z",
    "end_time": "2024-01-15T10:45:00Z",
    "fare": 25.5,
    "distance": 5.2,
    "duration": "00:15:00",
    "status": "completed"
  }
}
```

### 3. Accept Trip Request

**PUT** `/trips/{trip_id}/accept`

Allows drivers to accept trip requests with validation of driver availability and location proximity.

**Response:**

```json
{
  "success": true,
  "message": "Trip accepted successfully"
}
```

### 4. Start Trip

**PUT** `/trips/{trip_id}/start`

Marks trip start with location verification and passenger notification.

**Response:**

```json
{
  "success": true,
  "message": "Trip started successfully"
}
```

### 5. Complete Trip

**PUT** `/trips/{trip_id}/complete`

Completes trips with final fare calculation, payment processing, and points deduction.

**Request Body (optional):**

```json
{
  "actual_distance": 5.5,
  "actual_fare": 27.5
}
```

**Response:**

```json
{
  "success": true,
  "message": "Trip completed successfully",
  "data": {
    "final_fare": 27.5,
    "final_distance": 5.5
  }
}
```

### 6. Cancel Trip

**PUT** `/trips/{trip_id}/cancel`

Handles trip cancellations with appropriate policies and refund processing.

**Request Body (optional):**

```json
{
  "reason": "Passenger requested cancellation"
}
```

**Response:**

```json
{
  "success": true,
  "message": "Trip cancelled successfully",
  "data": {
    "cancellation_reason": "Passenger requested cancellation"
  }
}
```

### 7. Get Nearby Drivers

**GET** `/trips/nearby-drivers`

Returns available drivers near specified locations with distance calculation and estimated arrival times.

**Query Parameters:**

- `latitude` (required): Current latitude
- `longitude` (required): Current longitude
- `radius` (optional): Search radius in kilometers (default: 5)

**Example:**

```
GET /trips/nearby-drivers?latitude=40.7128&longitude=-74.0060&radius=3
```

**Response:**

```json
{
  "success": true,
  "data": {
    "location": {
      "latitude": 40.7128,
      "longitude": -74.006
    },
    "search_radius_km": 3,
    "available_drivers": [
      {
        "driver_id": 456,
        "license_number": "DL123456",
        "phone_number": "+1234567890",
        "distance_km": 1.2,
        "estimated_arrival_minutes": 3
      }
    ],
    "total_count": 1
  }
}
```

## Trip Status Flow

1. **requested** - Trip created by passenger
2. **accepted** - Driver accepts the trip
3. **started** - Driver starts the trip
4. **completed** - Trip finished successfully
5. **cancelled** - Trip cancelled by passenger or driver

## Error Responses

All endpoints return consistent error responses:

```json
{
  "success": false,
  "message": "Error description"
}
```

Common HTTP status codes:

- `400` - Bad Request (invalid input)
- `401` - Unauthorized (missing/invalid token)
- `403` - Forbidden (insufficient permissions)
- `404` - Not Found (resource doesn't exist)
- `500` - Internal Server Error

## Notes

- Only passengers can create trip requests
- Only drivers can accept, start, and complete trips
- Both passengers and drivers can cancel trips (if authorized)
- Distance calculations use the Haversine formula
- Fare estimation includes base fare + per-kilometer rate
- Driver location data is currently mocked (TODO: implement real location tracking)
