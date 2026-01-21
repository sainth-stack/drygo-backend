const express = require("express");
const router = express.Router();
const controller = require("../controllers/cartController");
const authenticate = require("../middleware/authMiddleware");

// All cart routes require authentication
router.use(authenticate);

// GET CART - Get user's cart (userId from token)
router.get("/", controller.getCart);

// ADD ITEM TO CART
router.post("/add", controller.addToCart);

// UPDATE CART ITEM QUANTITY
router.put("/update", controller.updateCartItem);

// REMOVE ITEM FROM CART
router.delete("/item/:productId", controller.removeCartItem);

// CLEAR CART
router.delete("/clear", controller.clearCart);

module.exports = router;
