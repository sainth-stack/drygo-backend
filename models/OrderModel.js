const mongoose = require("mongoose");

const shippingAddressSchema = new mongoose.Schema(
  {
    line1: {
      type: String,
      required: true
    },
    line2: {
      type: String
    },
    city: {
      type: String,
      required: true
    },
    state: {
      type: String,
      required: true
    },
    pincode: {
      type: String,
      required: true
    },
    country: {
      type: String,
      default: "India"
    }
  },
  { _id: false }
);

const orderItemSchema = new mongoose.Schema(
  {
    productId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Product",
      required: true
    },
    variantId: {
      type: String
    },
    weight: {
      type: String
    },
    quantity: {
      type: Number,
      required: true,
      min: 1
    },
    name: {
      type: String,
      required: true
    },
    price: {
      type: Number,
      required: true
    },
    image: {
      type: String
    }
  },
  { _id: false }
);

const orderSchema = new mongoose.Schema(
  {
    orderNumber: {
      type: String,
      required: true,
      unique: true
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User"
    },
    customerName: {
      type: String,
      required: true
    },
    customerEmail: {
      type: String,
      required: true
    },
    customerPhone: {
      type: String,
      required: true
    },
    shippingAddress: {
      type: shippingAddressSchema,
      required: true
    },
    items: [orderItemSchema],
    couponCode: {
      type: String
    },
    paymentMethod: {
      type: String,
      enum: ["razorpay", "cod"],
      required: true
    },
    orderStatus: {
      type: String,
      enum: ["pending", "confirmed", "processing", "shipped", "delivered", "cancelled"],
      default: "pending"
    },
    trackingNumber: {
      type: String
    },
    deliveryEstimate: {
      type: String
    },
    subtotal: {
      type: Number,
      required: true
    },
    shipping: {
      type: Number,
      default: 0
    },
    gst: {
      type: Number,
      default: 0
    },
    discount: {
      type: Number,
      default: 0
    },
    totalAmount: {
      type: Number,
      required: true
    },
    cancellationReason: {
      type: String
    }
  },
  { timestamps: true }
);

// Index for faster queries
orderSchema.index({ customerEmail: 1 });
orderSchema.index({ userId: 1 });

module.exports = mongoose.model("Order", orderSchema);
