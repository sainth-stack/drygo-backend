const mongoose = require("mongoose");

const couponSchema = new mongoose.Schema(
  {
    code: {
      type: String,
      required: true,
      unique: true,
      uppercase: true,
      trim: true
    },
    description: {
      type: String,
      default: ""
    },
    discountType: {
      type: String,
      enum: ["percentage", "fixed"],
      required: true
    },
    discountValue: {
      type: Number,
      required: true,
      min: 0
    },
    minOrderAmount: {
      type: Number,
      default: 0
    },
    maxDiscount: {
      type: Number,
      default: null // null means no cap (for percentage discounts)
    },
    usageLimit: {
      type: Number,
      default: null // null means unlimited usage
    },
    usedCount: {
      type: Number,
      default: 0
    },
    perUserLimit: {
      type: Number,
      default: 1 // How many times a single user can use this coupon
    },
    usedByUsers: [{
      userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User"
      },
      usedCount: {
        type: Number,
        default: 1
      }
    }],
    validFrom: {
      type: Date,
      default: Date.now
    },
    validUntil: {
      type: Date,
      required: true
    },
    isActive: {
      type: Boolean,
      default: true
    }
  },
  { timestamps: true }
);

// Index for faster lookups
couponSchema.index({ code: 1 });
couponSchema.index({ isActive: 1, validUntil: 1 });

module.exports = mongoose.model("Coupon", couponSchema);
