const jwt = require("jsonwebtoken");

/**
 * Authentication Middleware
 * Verifies JWT token and attaches userId to request
 */
const authenticate = (req, res, next) => {
  try {
    // Get token from header (token header name)
    const token = req.headers.token;
    
    if (!token) {
      return res.status(401).json({
        success: false,
        message: "No token provided. Please login first."
      });
    }

    // Verify token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    // Attach userId to request
    req.userId = decoded.userId;
    next();
  } catch (error) {
    if (error.name === "JsonWebTokenError") {
      return res.status(401).json({
        success: false,
        message: "Invalid token"
      });
    }
    if (error.name === "TokenExpiredError") {
      return res.status(401).json({
        success: false,
        message: "Token expired. Please login again."
      });
    }
    return res.status(500).json({
      success: false,
      message: "Authentication error"
    });
  }
};

module.exports = authenticate;
