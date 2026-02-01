const Order = require("../models/OrderModel");
const Product = require("../models/productModels/ProductModel");
const Cart = require("../models/CartModel");
const { applyCouponToOrder } = require("./couponController");
const { sendOrderWhatsApp } = require("../utils/sendWhatsApp");

/**
 * Helper → Generate unique order number
 */
const generateOrderNumber = () => {
  const timestamp = Date.now().toString(36).toUpperCase();
  const random = Math.random().toString(36).substring(2, 8).toUpperCase();
  return `ORD-${timestamp}-${random}`;
};

/**
 * Helper → Calculate totals
 * Based on UI: Free shipping at ₹250, shipping cost ₹49, GST 5%
 */
const calculateTotals = (items, discount = 0) => {
  const subtotal = items.reduce(
    (sum, item) => sum + item.price * item.quantity,
    0
  );

  const FREE_SHIPPING_THRESHOLD = 250;
  const shipping = subtotal >= FREE_SHIPPING_THRESHOLD ? 0 : 49;
  const gst = +((subtotal - discount) * 0.05).toFixed(2);
  const total = subtotal - discount + shipping + gst;

  return {
    subtotal: +subtotal.toFixed(2),
    shipping,
    gst,
    discount: +discount.toFixed(2),
    total: +total.toFixed(2)
  };
};

/**
 * Helper → Format order response
 */
const formatOrderResponse = (order) => {
  const orderObj = order.toObject ? order.toObject() : order;
  return {
    orderId: orderObj._id,
    orderNumber: orderObj.orderNumber,
    customerName: orderObj.customerName,
    customerEmail: orderObj.customerEmail,
    customerPhone: orderObj.customerPhone,
    shippingAddress: orderObj.shippingAddress,
    items: orderObj.items,
    couponCode: orderObj.couponCode || null,
    paymentMethod: orderObj.paymentMethod,
    orderStatus: orderObj.orderStatus,
    trackingNumber: orderObj.trackingNumber || null,
    deliveryEstimate: orderObj.deliveryEstimate || null,
    subtotal: orderObj.subtotal,
    shipping: orderObj.shipping,
    gst: orderObj.gst,
    discount: orderObj.discount,
    totalAmount: orderObj.totalAmount,
    cancellationReason: orderObj.cancellationReason || null,
    createdAt: orderObj.createdAt,
    updatedAt: orderObj.updatedAt
  };
};

// CREATE ORDER
exports.createOrder = async (req, res) => {
  try {
    const userId = req.userId; // From authentication middleware
    const {
      customerName,
      customerEmail,
      customerPhone,
      shippingAddress,
      cartItems,
      couponCode,
      paymentMethod
    } = req.body;

    // Validate required fields
    if (!customerName || !customerEmail || !customerPhone || !shippingAddress || !cartItems || !paymentMethod) {
      return res.status(400).json({
        success: false,
        message: "Missing required fields: customerName, customerEmail, customerPhone, shippingAddress, cartItems, paymentMethod"
      });
    }

    // Validate shipping address
    if (!shippingAddress.line1 || !shippingAddress.city || !shippingAddress.state || !shippingAddress.pincode) {
      return res.status(400).json({
        success: false,
        message: "Shipping address must include: line1, city, state, pincode"
      });
    }

    // Validate payment method
    if (!["razorpay", "cod"].includes(paymentMethod)) {
      return res.status(400).json({
        success: false,
        message: "Payment method must be 'razorpay' or 'cod'"
      });
    }

    // Validate cart items
    if (!Array.isArray(cartItems) || cartItems.length === 0) {
      return res.status(400).json({
        success: false,
        message: "cartItems must be a non-empty array"
      });
    }

    // Fetch product details and build order items
    const orderItems = [];
    for (const cartItem of cartItems) {
      if (!cartItem.productId || !cartItem.quantity) {
        return res.status(400).json({
          success: false,
          message: "Each cartItem must have productId and quantity"
        });
      }

      const product = await Product.findById(cartItem.productId);
      if (!product) {
        return res.status(404).json({
          success: false,
          message: `Product not found: ${cartItem.productId}`
        });
      }

      const price = typeof product.price === 'string'
        ? parseFloat(product.price.replace(/[₹,]/g, ''))
        : product.price;

      orderItems.push({
        productId: product._id,
        variantId: cartItem.variantId || null,
        weight: cartItem.weight || null,
        quantity: cartItem.quantity,
        name: product.name,
        price: price,
        image: product.image || null
      });
    }

    // Calculate subtotal first (before discount)
    const subtotal = orderItems.reduce(
      (sum, item) => sum + item.price * item.quantity,
      0
    );

    // Validate and apply coupon if provided
    let discount = 0;
    let appliedCouponCode = null;
    
    if (couponCode) {
      const couponResult = await applyCouponToOrder(couponCode, subtotal, userId);
      
      if (!couponResult.valid && couponResult.error) {
        return res.status(400).json({
          success: false,
          message: `Coupon error: ${couponResult.error}`
        });
      }
      
      if (couponResult.valid) {
        discount = couponResult.discount;
        appliedCouponCode = couponCode.toUpperCase().trim();
      }
    }

    // Calculate totals with discount
    const totals = calculateTotals(orderItems, discount);

    // Generate order number
    let orderNumber;
    let isUnique = false;
    while (!isUnique) {
      orderNumber = generateOrderNumber();
      const existingOrder = await Order.findOne({ orderNumber });
      if (!existingOrder) {
        isUnique = true;
      }
    }

    // Calculate delivery estimate (7-10 business days)
    const deliveryEstimate = new Date();
    deliveryEstimate.setDate(deliveryEstimate.getDate() + 7);
    const deliveryEstimateStr = deliveryEstimate.toISOString().split('T')[0];

    // Create order
    const order = await Order.create({
      orderNumber,
      userId,
      customerName,
      customerEmail: customerEmail.toLowerCase().trim(),
      customerPhone,
      shippingAddress: {
        ...shippingAddress,
        country: shippingAddress.country || "India"
      },
      items: orderItems,
      couponCode: appliedCouponCode,
      paymentMethod,
      orderStatus: "pending",
      deliveryEstimate: deliveryEstimateStr,
      subtotal: totals.subtotal,
      shipping: totals.shipping,
      gst: totals.gst,
      discount: totals.discount,
      totalAmount: totals.total
    });

    // Populate product details
    await order.populate('items.productId', 'name price image');

    // Send order details to business WhatsApp (non-blocking)
    sendOrderWhatsApp(order).catch((err) =>
      console.error("WhatsApp notification error:", err.message)
    );

    res.status(201).json({
      success: true,
      message: "Order created successfully",
      data: {
        orderId: order._id,
        orderNumber: order.orderNumber,
        totalAmount: order.totalAmount,
        paymentMethod: order.paymentMethod,
        orderStatus: order.orderStatus,
        deliveryEstimate: order.deliveryEstimate
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message || "Failed to create order"
    });
  }
};

// GET ALL ORDERS BY USER ID (authenticated user's orders)
exports.getOrdersByUserId = async (req, res) => {
  try {
    const authUserId = req.userId; // From authentication middleware
    const { userId } = req.params;

    if (!userId) {
      return res.status(400).json({
        success: false,
        message: "User ID is required"
      });
    }

    // Users can only fetch their own orders
    if (authUserId.toString() !== userId.toString()) {
      return res.status(403).json({
        success: false,
        message: "You can only view your own orders"
      });
    }

    const orders = await Order.find({ userId: authUserId })
      .populate('items.productId', 'name price image')
      .sort({ createdAt: -1 });

    res.json({
      success: true,
      data: orders.map(order => formatOrderResponse(order))
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message || "Failed to fetch orders"
    });
  }
};

// GET ORDERS (by email query param) OR GET ORDER BY ORDER NUMBER
exports.getOrders = async (req, res) => {
  try {
    const { email } = req.query;

    // If email query param exists, return orders by email
    if (email) {
      const orders = await Order.find({ customerEmail: email.toLowerCase().trim() })
        .populate('items.productId', 'name price image')
        .sort({ createdAt: -1 });

      return res.json({
        success: true,
        data: orders.map(order => formatOrderResponse(order))
      });
    }

    // If no email param, this route shouldn't be hit (should be caught by orderNumber route)
    // But handle it gracefully
    return res.status(400).json({
      success: false,
      message: "Please provide email query parameter or order number"
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message || "Failed to fetch orders"
    });
  }
};

// GET ORDER BY ORDER NUMBER
exports.getOrderByOrderNumber = async (req, res) => {
  try {
    const { orderNumber } = req.params;
    const verifyEmail = req.headers['x-verify-email'];

    if (!orderNumber) {
      return res.status(400).json({
        success: false,
        message: "Order number is required"
      });
    }

    const order = await Order.findOne({ orderNumber }).populate('items.productId', 'name price image');

    if (!order) {
      return res.status(404).json({
        success: false,
        message: "Order not found"
      });
    }

    // Email verification (if provided)
    if (verifyEmail) {
      if (order.customerEmail.toLowerCase() !== verifyEmail.toLowerCase()) {
        return res.status(403).json({
          success: false,
          message: "Email verification failed. Order not found for this email."
        });
      }
    }

    res.json({
      success: true,
      data: formatOrderResponse(order)
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message || "Failed to fetch order"
    });
  }
};

// GET ORDER BY ID
exports.getOrderById = async (req, res) => {
  try {
    const { orderId } = req.params;
    const verifyEmail = req.headers['x-verify-email'];

    if (!orderId) {
      return res.status(400).json({
        success: false,
        message: "Order ID is required"
      });
    }

    const order = await Order.findById(orderId).populate('items.productId', 'name price image');

    if (!order) {
      return res.status(404).json({
        success: false,
        message: "Order not found"
      });
    }

    // Email verification (if provided)
    if (verifyEmail) {
      if (order.customerEmail.toLowerCase() !== verifyEmail.toLowerCase()) {
        return res.status(403).json({
          success: false,
          message: "Email verification failed. Order not found for this email."
        });
      }
    }

    res.json({
      success: true,
      data: formatOrderResponse(order)
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message || "Failed to fetch order"
    });
  }
};


// UPDATE ORDER STATUS (Admin)
exports.updateOrderStatus = async (req, res) => {
  try {
    const { orderId } = req.params;
    const { orderStatus, trackingNumber, deliveryEstimate } = req.body;

    if (!orderId) {
      return res.status(400).json({
        success: false,
        message: "Order ID is required"
      });
    }

    if (!orderStatus) {
      return res.status(400).json({
        success: false,
        message: "Order status is required"
      });
    }

    // Validate order status
    const validStatuses = ["pending", "confirmed", "processing", "shipped", "delivered", "cancelled"];
    if (!validStatuses.includes(orderStatus)) {
      return res.status(400).json({
        success: false,
        message: `Order status must be one of: ${validStatuses.join(", ")}`
      });
    }

    const order = await Order.findById(orderId);

    if (!order) {
      return res.status(404).json({
        success: false,
        message: "Order not found"
      });
    }

    // Update order
    order.orderStatus = orderStatus;
    if (trackingNumber) order.trackingNumber = trackingNumber;
    if (deliveryEstimate) order.deliveryEstimate = deliveryEstimate;

    await order.save();
    await order.populate('items.productId', 'name price image');

    res.json({
      success: true,
      message: "Order status updated successfully",
      data: formatOrderResponse(order)
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message || "Failed to update order status"
    });
  }
};

// CANCEL ORDER
exports.cancelOrder = async (req, res) => {
  try {
    const userId = req.userId; // From authentication middleware
    const { orderId } = req.params;
    const { reason } = req.body;

    if (!orderId) {
      return res.status(400).json({
        success: false,
        message: "Order ID is required"
      });
    }

    const order = await Order.findById(orderId);

    if (!order) {
      return res.status(404).json({
        success: false,
        message: "Order not found"
      });
    }

    // Verify user owns the order (optional check)
    if (order.userId && order.userId.toString() !== userId.toString()) {
      return res.status(403).json({
        success: false,
        message: "You are not authorized to cancel this order"
      });
    }

    // Check if order can be cancelled
    if (order.orderStatus === "cancelled") {
      return res.status(400).json({
        success: false,
        message: "Order is already cancelled"
      });
    }

    if (order.orderStatus === "delivered") {
      return res.status(400).json({
        success: false,
        message: "Cannot cancel a delivered order"
      });
    }

    // Update order
    order.orderStatus = "cancelled";
    if (reason) order.cancellationReason = reason;

    await order.save();
    await order.populate('items.productId', 'name price image');

    res.json({
      success: true,
      message: "Order cancelled successfully",
      data: formatOrderResponse(order)
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message || "Failed to cancel order"
    });
  }
};
