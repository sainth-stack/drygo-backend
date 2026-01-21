const express = require("express");
const router = express.Router();
const controller = require("../controllers/orderController");
const authenticate = require("../middleware/authMiddleware");

// CREATE ORDER - Requires authentication
router.post("/", authenticate, controller.createOrder);

// GET ORDER BY ID - Must come before /:orderNumber route
router.get("/id/:orderId", controller.getOrderById);

// GET ORDERS BY EMAIL OR ORDER BY ORDER NUMBER
// GET /api/orders?email=... - Get orders by email
// GET /api/orders/:orderNumber - Get order by order number
router.get("/", controller.getOrders);
router.get("/:orderNumber", controller.getOrderByOrderNumber);

// UPDATE ORDER STATUS - Requires authentication (can add admin check later)
router.put("/:orderId/status", authenticate, controller.updateOrderStatus);

// CANCEL ORDER - Requires authentication
router.post("/:orderId/cancel", authenticate, controller.cancelOrder);

module.exports = router;
