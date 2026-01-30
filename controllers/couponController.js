const Coupon = require("../models/CouponModel");

/**
 * Helper → Calculate discount amount based on coupon type
 */
const calculateDiscount = (coupon, cartTotal) => {
  let discount = 0;

  if (coupon.discountType === "percentage") {
    discount = (cartTotal * coupon.discountValue) / 100;
    // Apply max discount cap if set
    if (coupon.maxDiscount && discount > coupon.maxDiscount) {
      discount = coupon.maxDiscount;
    }
  } else if (coupon.discountType === "fixed") {
    discount = coupon.discountValue;
    // Fixed discount cannot exceed cart total
    if (discount > cartTotal) {
      discount = cartTotal;
    }
  }

  return +discount.toFixed(2);
};

/**
 * VALIDATE COUPON
 * POST /api/coupon/validate
 * Checks if coupon is valid and returns discount amount
 */
exports.validateCoupon = async (req, res) => {
  try {
    const { code, cartTotal } = req.body;
    const userId = req.userId; // From authentication middleware (optional)

    // Validate input
    if (!code) {
      return res.status(400).json({
        success: false,
        message: "Coupon code is required"
      });
    }

    if (!cartTotal || cartTotal <= 0) {
      return res.status(400).json({
        success: false,
        message: "Valid cart total is required"
      });
    }

    // Find coupon by code (case-insensitive)
    const coupon = await Coupon.findOne({ 
      code: code.toUpperCase().trim() 
    });

    // Check if coupon exists
    if (!coupon) {
      return res.status(404).json({
        success: false,
        message: "Invalid coupon code"
      });
    }

    // Check if coupon is active
    if (!coupon.isActive) {
      return res.status(400).json({
        success: false,
        message: "This coupon is no longer active"
      });
    }

    // Check if coupon has started
    const now = new Date();
    if (coupon.validFrom > now) {
      return res.status(400).json({
        success: false,
        message: "This coupon is not yet valid"
      });
    }

    // Check if coupon has expired
    if (coupon.validUntil < now) {
      return res.status(400).json({
        success: false,
        message: "This coupon has expired"
      });
    }

    // Check usage limit
    if (coupon.usageLimit !== null && coupon.usedCount >= coupon.usageLimit) {
      return res.status(400).json({
        success: false,
        message: "This coupon has reached its usage limit"
      });
    }

    // Check per-user limit (if user is authenticated)
    if (userId && coupon.perUserLimit) {
      const userUsage = coupon.usedByUsers.find(
        (u) => u.userId.toString() === userId.toString()
      );
      if (userUsage && userUsage.usedCount >= coupon.perUserLimit) {
        return res.status(400).json({
          success: false,
          message: `You have already used this coupon ${coupon.perUserLimit} time(s)`
        });
      }
    }

    // Check minimum order amount
    if (cartTotal < coupon.minOrderAmount) {
      return res.status(400).json({
        success: false,
        message: `Minimum order amount of ₹${coupon.minOrderAmount} required for this coupon`
      });
    }

    // Calculate discount
    const discount = calculateDiscount(coupon, cartTotal);

    // Return success response
    res.json({
      success: true,
      message: "Coupon applied successfully",
      data: {
        code: coupon.code,
        description: coupon.description,
        discountType: coupon.discountType,
        discountValue: coupon.discountValue,
        discount: discount,
        cartTotal: cartTotal,
        newTotal: +(cartTotal - discount).toFixed(2)
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message || "Failed to validate coupon"
    });
  }
};

/**
 * APPLY COUPON TO ORDER (Internal use)
 * Called when order is created to re-validate and mark coupon as used
 */
exports.applyCouponToOrder = async (couponCode, cartTotal, userId) => {
  if (!couponCode) {
    return { valid: false, discount: 0, error: null };
  }

  try {
    const coupon = await Coupon.findOne({ 
      code: couponCode.toUpperCase().trim() 
    });

    if (!coupon) {
      return { valid: false, discount: 0, error: "Invalid coupon code" };
    }

    // Validate all conditions
    const now = new Date();
    
    if (!coupon.isActive) {
      return { valid: false, discount: 0, error: "Coupon is not active" };
    }
    
    if (coupon.validFrom > now) {
      return { valid: false, discount: 0, error: "Coupon is not yet valid" };
    }
    
    if (coupon.validUntil < now) {
      return { valid: false, discount: 0, error: "Coupon has expired" };
    }
    
    if (coupon.usageLimit !== null && coupon.usedCount >= coupon.usageLimit) {
      return { valid: false, discount: 0, error: "Coupon usage limit reached" };
    }
    
    if (userId && coupon.perUserLimit) {
      const userUsage = coupon.usedByUsers.find(
        (u) => u.userId.toString() === userId.toString()
      );
      if (userUsage && userUsage.usedCount >= coupon.perUserLimit) {
        return { valid: false, discount: 0, error: "User limit exceeded for this coupon" };
      }
    }
    
    if (cartTotal < coupon.minOrderAmount) {
      return { valid: false, discount: 0, error: `Minimum order ₹${coupon.minOrderAmount} required` };
    }

    // Calculate discount
    const discount = calculateDiscount(coupon, cartTotal);

    // Mark coupon as used
    coupon.usedCount += 1;
    
    // Track per-user usage
    if (userId) {
      const userUsageIndex = coupon.usedByUsers.findIndex(
        (u) => u.userId.toString() === userId.toString()
      );
      if (userUsageIndex > -1) {
        coupon.usedByUsers[userUsageIndex].usedCount += 1;
      } else {
        coupon.usedByUsers.push({ userId, usedCount: 1 });
      }
    }
    
    await coupon.save();

    return { valid: true, discount, error: null };
  } catch (error) {
    return { valid: false, discount: 0, error: error.message };
  }
};

/**
 * CREATE COUPON (Admin)
 * POST /api/coupon/create
 */
exports.createCoupon = async (req, res) => {
  try {
    const {
      code,
      description,
      discountType,
      discountValue,
      minOrderAmount,
      maxDiscount,
      usageLimit,
      perUserLimit,
      validFrom,
      validUntil,
      isActive
    } = req.body;

    // Validate required fields
    if (!code || !discountType || discountValue === undefined || !validUntil) {
      return res.status(400).json({
        success: false,
        message: "Required fields: code, discountType, discountValue, validUntil"
      });
    }

    // Validate discount type
    if (!["percentage", "fixed"].includes(discountType)) {
      return res.status(400).json({
        success: false,
        message: "discountType must be 'percentage' or 'fixed'"
      });
    }

    // Validate discount value
    if (discountType === "percentage" && (discountValue < 0 || discountValue > 100)) {
      return res.status(400).json({
        success: false,
        message: "Percentage discount must be between 0 and 100"
      });
    }

    // Check if coupon code already exists
    const existingCoupon = await Coupon.findOne({ 
      code: code.toUpperCase().trim() 
    });
    
    if (existingCoupon) {
      return res.status(400).json({
        success: false,
        message: "Coupon code already exists"
      });
    }

    // Create coupon
    const coupon = await Coupon.create({
      code: code.toUpperCase().trim(),
      description: description || "",
      discountType,
      discountValue,
      minOrderAmount: minOrderAmount || 0,
      maxDiscount: maxDiscount || null,
      usageLimit: usageLimit || null,
      perUserLimit: perUserLimit || 1,
      validFrom: validFrom ? new Date(validFrom) : new Date(),
      validUntil: new Date(validUntil),
      isActive: isActive !== undefined ? isActive : true
    });

    res.status(201).json({
      success: true,
      message: "Coupon created successfully",
      data: coupon
    });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(400).json({
        success: false,
        message: "Coupon code already exists"
      });
    }
    res.status(500).json({
      success: false,
      message: error.message || "Failed to create coupon"
    });
  }
};

/**
 * GET ALL COUPONS (Admin)
 * GET /api/coupon/all
 */
exports.getAllCoupons = async (req, res) => {
  try {
    const { active } = req.query;
    
    let query = {};
    if (active === "true") {
      query.isActive = true;
      query.validUntil = { $gte: new Date() };
    } else if (active === "false") {
      query.$or = [
        { isActive: false },
        { validUntil: { $lt: new Date() } }
      ];
    }

    const coupons = await Coupon.find(query).sort({ createdAt: -1 });

    res.json({
      success: true,
      data: coupons,
      count: coupons.length
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message || "Failed to fetch coupons"
    });
  }
};

/**
 * GET SINGLE COUPON (Admin)
 * GET /api/coupon/:id
 */
exports.getCouponById = async (req, res) => {
  try {
    const { id } = req.params;

    const coupon = await Coupon.findById(id);

    if (!coupon) {
      return res.status(404).json({
        success: false,
        message: "Coupon not found"
      });
    }

    res.json({
      success: true,
      data: coupon
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message || "Failed to fetch coupon"
    });
  }
};

/**
 * UPDATE COUPON (Admin)
 * PUT /api/coupon/:id
 */
exports.updateCoupon = async (req, res) => {
  try {
    const { id } = req.params;
    const updateData = req.body;

    // Don't allow updating the code
    delete updateData.code;
    delete updateData.usedCount;
    delete updateData.usedByUsers;

    const coupon = await Coupon.findByIdAndUpdate(
      id,
      updateData,
      { new: true, runValidators: true }
    );

    if (!coupon) {
      return res.status(404).json({
        success: false,
        message: "Coupon not found"
      });
    }

    res.json({
      success: true,
      message: "Coupon updated successfully",
      data: coupon
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message || "Failed to update coupon"
    });
  }
};

/**
 * DELETE COUPON (Admin)
 * DELETE /api/coupon/:id
 */
exports.deleteCoupon = async (req, res) => {
  try {
    const { id } = req.params;

    const coupon = await Coupon.findByIdAndDelete(id);

    if (!coupon) {
      return res.status(404).json({
        success: false,
        message: "Coupon not found"
      });
    }

    res.json({
      success: true,
      message: "Coupon deleted successfully"
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message || "Failed to delete coupon"
    });
  }
};
