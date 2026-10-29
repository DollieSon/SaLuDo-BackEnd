import { inject } from "vitest";

// Route modules connect to MongoDB as soon as they are imported, so the test
// environment is fixed here, before any test file imports the app.
// NODE_ENV=development keeps the rate limits loose enough for the suite.
process.env.NODE_ENV = "development";
process.env.MONGO_URI = inject("mongoUri");
process.env.JWT_SECRET = "test-jwt-secret-0123456789abcdef0123456789abcdef0123456789abcdef";
process.env.JWT_REFRESH_SECRET = "test-refresh-secret-fedcba9876543210fedcba9876543210fedcba98765";
process.env.GOOGLE_API_KEY = "test-google-api-key";
process.env.CORS_ORIGIN = "http://localhost:5173";
