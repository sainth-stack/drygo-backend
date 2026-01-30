const express = require("express");
const router = express.Router();
const controller = require("../controllers/couponController");
const authenticate = require("../middleware/authMiddleware");

// VALIDATE COUPON - User can validate coupon (authentication optional for validation)
router.post("/validate", (req, res, next) => {
  // Optional authentication - try to get userId if token provided
  const token = req.headers.token;
  if (token) {
    return authenticate(req, res, next);
  }
  next();
}, controller.validateCoupon);

// ADMIN ROUTES (Add admin middleware later for production)
// CREATE COUPON
router.post("/create", controller.createCoupon);

// GET ALL COUPONS
router.get("/all", controller.getAllCoupons);

// GET SINGLE COUPON
router.get("/:id", controller.getCouponById);

// UPDATE COUPON
router.put("/:id", controller.updateCoupon);

// DELETE COUPON
router.delete("/:id", controller.deleteCoupon);

module.exports = router;
