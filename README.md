# Node.js Starter Project

A basic Node.js project setup with Express server and essential configurations.

## Features

- Express.js server
- Environment configuration with dotenv
- Basic API endpoint
- Development mode with nodemon
- Testing setup with Jest

## Prerequisites

- Node.js (v14 or higher)
- npm (v6 or higher)

## Installation

1. Clone the repository:

```bash
git clone <repository-url>
cd driver
```

2. Install dependencies:

```bash
npm install
```

3. Create a `.env` file in the root directory (already provided with default values)

## Running the Application

### Development mode

```bash
npm run dev
```

### Production mode

```bash
npm start
```

### Run tests

```bash
npm test
```

## Project Structure

```
├── src/
│   └── index.js          # Application entry point
├── .env                  # Environment variables
├── package.json          # Project dependencies and scripts
└── README.md            # Project documentation
```

## API Endpoints

- `GET /`: Welcome message

## Authentication API

## Endpoints

### 1. Register

- **POST /api/v1/auth/register**
- **Body:** `{ "phoneNumber": "201011188416", "password": "your_password", "userType": "passenger", ... }`
- **Response:**
  - Success: `{ success: true, message: "User registered successfully", userId: 1 }`
  - Error: `{ success: false, message: "..." }`

### 2. Login (Send OTP)

- **POST /api/v1/auth/login**
- **Body:** `{ "phoneNumber": "201011188416" }`
- **Response:**
  - Success: `{ success: true, message: "OTP sent to your phone", mockOTP: "123456" }`
  - Error: `{ success: false, message: "..." }`

### 3. Verify OTP (Get JWT)

- **POST /api/v1/auth/verify**
- **Body:** `{ "phoneNumber": "201011188416", "otp": "123456" }`
- **Response:**
  - Success: `{ success: true, message: "Phone number verified successfully", token: "<JWT>" }`
  - Error: `{ success: false, message: "..." }`

### 4. Get Current User (Protected)

- **GET /api/v1/auth/me**
- **Headers:** `Authorization: Bearer <token>`
- **Response:**
  - Success: `{ success: true, user: { ... } }`
  - Error: `{ success: false, message: "..." }`

## JWT Authentication

- After verifying OTP, you receive a JWT token.
- All protected endpoints require the header: `Authorization: Bearer <token>`
- The token is valid for 7 days.
- If the user is not verified, access to protected endpoints is denied.

## Database Tables

- **users**: Stores user phone numbers, password hash, verification status, and timestamps.
- **otp**: Stores OTP codes and expiration for each phone number.
- **passengers, drivers, buyers**: Store extra info for each user type.

See the code for table structure and more details.

## License

ISC
