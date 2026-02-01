const path = require("path");
const dotEnv = require("dotenv");

const envResult = dotEnv.config({ path: path.join(__dirname, ".env") });
if (envResult.error) {
  console.warn("⚠️  .env file not found at:", path.join(__dirname, ".env"));
} else if (envResult.parsed) {
  console.log("✅ .env loaded");
}

const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const productRoutes = require("./routes/productRoutes/productRoutes");
const cartRoutes = require("./routes/cartRoutes");
const orderRoutes = require("./routes/orderRoutes");
const authRoutes = require("./routes/AuthRoutes");
const contactRoutes = require("./routes/contactRoutes");
const couponRoutes = require("./routes/couponRoutes");

const app = express();
const PORT = 4000;




// Middleware
// CORS configuration - allow requests from frontend
app.use(cors({
  origin: "http://localhost:8080",
  credentials: true
}));

// JSON parser with error handling for empty bodies
const jsonParser = express.json();

app.use((req, res, next) => {
  // Wrap JSON parser to catch empty body errors
  jsonParser(req, res, (err) => {
    if (err) {
      // Handle JSON parsing errors (empty or invalid JSON)
      if (err instanceof SyntaxError && err.status === 400 && 'body' in err) {
        // For DELETE/GET requests or empty bodies, set empty object
        if (['DELETE', 'GET'].includes(req.method)) {
          req.body = {};
          return next();
        }
        // For other methods with empty body, also allow it
        if (!req.body || Object.keys(req.body).length === 0) {
          req.body = {};
          return next();
        }
        return res.status(400).json({
          success: false,
          message: "Invalid JSON in request body"
        });
      }
      return next(err);
    }
    next();
  });
});

// MongoDB Connection with better error handling
mongoose
  .connect(process.env.MONGO_URL)
  .then(() => {
    console.log("✅ MongoDB connected successfully");
    console.log("Database:", mongoose.connection.name);
    console.log("Host:", mongoose.connection.host);
  })
  .catch((error) => {
    console.error("❌ MongoDB connection error:", error.message);
    if (error.message.includes("authentication failed")) {
      console.error("⚠️  Check your MongoDB username and password");
    }
    if (error.message.includes("IP")) {
      console.error("⚠️  Your IP address may need to be whitelisted in MongoDB Atlas");
      console.error("   Go to: MongoDB Atlas > Network Access > Add IP Address");
    }
  });

// MongoDB connection event listeners
mongoose.connection.on("connected", () => {
  console.log("✅ Mongoose connected to MongoDB");
});

mongoose.connection.on("error", (err) => {
  console.error("❌ Mongoose connection error:", err);
});

mongoose.connection.on("disconnected", () => {
  console.warn("⚠️  Mongoose disconnected from MongoDB");
});

// Routes
app.use("/api/auth", authRoutes);

app.use("/api/products", productRoutes);
app.use("/api/cart", cartRoutes);
app.use("/api/orders", orderRoutes);
app.use("/api/contact", contactRoutes);
app.use("/api/coupon", couponRoutes);

app.use("/home", (req, res) => {
  res.send("<h1>Welcome to DryGo</h1>");
});

// Health check endpoint
app.get("/api/health", (req, res) => {
  const dbStatus = mongoose.connection.readyState;
  const statusMessages = {
    0: "disconnected",
    1: "connected",
    2: "connecting",
    3: "disconnecting"
  };
  
  res.json({
    status: "ok",
    database: statusMessages[dbStatus] || "unknown",
    databaseState: dbStatus,
    timestamp: new Date().toISOString()
  });
});

// WhatsApp config check (for debugging - no secrets exposed)
app.get("/api/whatsapp-status", (req, res) => {
  const sid = process.env.TWILIO_ACCOUNT_SID;
  const token = process.env.TWILIO_AUTH_TOKEN;
  res.json({
    configured: !!(sid && token),
    hasSid: !!sid,
    hasToken: !!token,
    envPath: path.join(__dirname, ".env"),
    hint: !(sid && token)
      ? "Add TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN to .env file"
      : "Ready"
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Server started and running on port ${PORT}`);
  const hasTwilio = process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN;
  if (!hasTwilio) {
    console.log("⚠️  WhatsApp disabled: Add TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN to your .env file");
    console.log("   File location: " + path.join(__dirname, ".env"));
  } else {
    console.log("✅ WhatsApp order notifications enabled");
  }
});
