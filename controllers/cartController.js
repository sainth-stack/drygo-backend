const Cart = require("../models/CartModel");
const Product = require("../models/productModels/ProductModel");

/**
 * Helper → Calculate totals
 * Based on UI: Free shipping at ₹250, shipping cost ₹49, GST 5%
 */
const calculateTotals = (items) => {
  const subtotal = items.reduce(
    (sum, item) => sum + item.price * item.quantity,
    0
  );

  const FREE_SHIPPING_THRESHOLD = 250;
  const shipping = subtotal >= FREE_SHIPPING_THRESHOLD ? 0 : 49;
  const gst = +(subtotal * 0.05).toFixed(2);
  const total = subtotal + shipping + gst;
  
  // Calculate amount needed for free shipping
  const amountForFreeShipping = subtotal < FREE_SHIPPING_THRESHOLD 
    ? FREE_SHIPPING_THRESHOLD - subtotal 
    : 0;

  return { 
    subtotal: +subtotal.toFixed(2), 
    shipping, 
    gst, 
    total: +total.toFixed(2),
    amountForFreeShipping: +amountForFreeShipping.toFixed(2),
    freeShippingThreshold: FREE_SHIPPING_THRESHOLD
  };
};

// GET CART
exports.getCart = async (req, res) => {
  try {
    const userId = req.userId; // From authentication middleware

    const cart = await Cart.findOne({ userId }).populate('items.productId', 'name price image');

    if (!cart || cart.items.length === 0) {
      const totals = calculateTotals([]);
      return res.json({
        success: true,
        data: { 
          items: [], 
          ...totals,
          message: totals.amountForFreeShipping > 0 
            ? `Add ₹${totals.amountForFreeShipping} more for free shipping!`
            : null
        }
      });
    }

    // Format items with product details
    const formattedItems = cart.items.map(item => {
      const productId = item.productId._id ? item.productId._id.toString() : item.productId.toString();
      return {
        productId,
        name: item.name,
        price: item.price,
        image: item.image || (item.productId?.image || ''),
        quantity: item.quantity
      };
    });

    const totals = calculateTotals(cart.items);

    res.json({
      success: true,
      data: {
        items: formattedItems,
        itemCount: cart.items.length,
        ...totals,
        message: totals.amountForFreeShipping > 0 
          ? `Add ₹${totals.amountForFreeShipping} more for free shipping!`
          : null
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ADD ITEM TO CART
exports.addToCart = async (req, res) => {
  try {
    const userId = req.userId; // From authentication middleware
    const { productId, quantity = 1 } = req.body;

    // Validate input
    if (!productId) {
      return res.status(400).json({
        success: false,
        message: "Product ID is required"
      });
    }

    // Fetch product details
    const product = await Product.findById(productId);
    if (!product) {
      return res.status(404).json({
        success: false,
        message: "Product not found"
      });
    }

    // Convert price to number if it's a string
    const price = typeof product.price === 'string' 
      ? parseFloat(product.price.replace(/[₹,]/g, '')) 
      : product.price;

    // Find or create cart
    let cart = await Cart.findOne({ userId });

    if (!cart) {
      cart = await Cart.create({
        userId,
        items: [{
          productId,
          name: product.name,
          price,
          image: product.image,
          quantity: quantity || 1
        }]
      });
    } else {
      const itemIndex = cart.items.findIndex(
        (item) => item.productId.toString() === productId
      );

      if (itemIndex > -1) {
        // Update quantity if item exists
        cart.items[itemIndex].quantity += (quantity || 1);
      } else {
        // Add new item
        cart.items.push({
          productId,
          name: product.name,
          price,
          image: product.image,
          quantity: quantity || 1
        });
      }

      await cart.save();
    }

    // Populate and format response
    await cart.populate('items.productId', 'name price image');
    const formattedItems = cart.items.map(item => ({
      productId: item.productId._id || item.productId,
      name: item.name,
      price: item.price,
      image: item.image || (item.productId?.image || ''),
      quantity: item.quantity
    }));

    const totals = calculateTotals(cart.items);

    res.json({
      success: true,
      message: "Item added to cart successfully",
      data: {
        items: formattedItems,
        itemCount: cart.items.length,
        ...totals,
        message: totals.amountForFreeShipping > 0 
          ? `Add ₹${totals.amountForFreeShipping} more for free shipping!`
          : null
      }
    });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

// UPDATE CART ITEM
exports.updateCartItem = async (req, res) => {
  try {
    const userId = req.userId; // From authentication middleware
    const { productId, quantity } = req.body;

    // Validate input
    if (!productId || !quantity) {
      return res.status(400).json({
        success: false,
        message: "Product ID and quantity are required"
      });
    }

    if (quantity < 1) {
      return res.status(400).json({
        success: false,
        message: "Quantity must be at least 1"
      });
    }

    const cart = await Cart.findOne({ userId });
    if (!cart) {
      return res.status(404).json({
        success: false,
        message: "Cart not found"
      });
    }

    const item = cart.items.find(
      (item) => item.productId.toString() === productId
    );

    if (!item) {
      return res.status(404).json({
        success: false,
        message: "Item not found in cart"
      });
    }

    item.quantity = quantity;
    await cart.save();

    // Populate and format response
    await cart.populate('items.productId', 'name price image');
    const formattedItems = cart.items.map(item => ({
      productId: item.productId._id || item.productId,
      name: item.name,
      price: item.price,
      image: item.image || (item.productId?.image || ''),
      quantity: item.quantity
    }));

    const totals = calculateTotals(cart.items);

    res.json({
      success: true,
      message: "Cart item updated successfully",
      data: {
        items: formattedItems,
        itemCount: cart.items.length,
        ...totals,
        message: totals.amountForFreeShipping > 0 
          ? `Add ₹${totals.amountForFreeShipping} more for free shipping!`
          : null
      }
    });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

// REMOVE CART ITEM
exports.removeCartItem = async (req, res) => {
  try {
    const userId = req.userId; // From authentication middleware
    const { productId } = req.params;

    if (!productId) {
      return res.status(400).json({
        success: false,
        message: "Product ID is required"
      });
    }

    const cart = await Cart.findOne({ userId });
    if (!cart) {
      return res.status(404).json({
        success: false,
        message: "Cart not found"
      });
    }

    const initialLength = cart.items.length;
    cart.items = cart.items.filter(
      (item) => item.productId.toString() !== productId
    );

    if (cart.items.length === initialLength) {
      return res.status(404).json({
        success: false,
        message: "Item not found in cart"
      });
    }

    await cart.save();

    // Populate and format response
    await cart.populate('items.productId', 'name price image');
    const formattedItems = cart.items.map(item => ({
      productId: item.productId._id || item.productId,
      name: item.name,
      price: item.price,
      image: item.image || (item.productId?.image || ''),
      quantity: item.quantity
    }));

    const totals = calculateTotals(cart.items);

    res.json({
      success: true,
      message: "Item removed from cart successfully",
      data: {
        items: formattedItems,
        itemCount: cart.items.length,
        ...totals,
        message: totals.amountForFreeShipping > 0 
          ? `Add ₹${totals.amountForFreeShipping} more for free shipping!`
          : null
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// CLEAR CART
exports.clearCart = async (req, res) => {
  try {
    const userId = req.userId; // From authentication middleware

    const cart = await Cart.findOne({ userId });
    if (!cart) {
      return res.status(404).json({
        success: false,
        message: "Cart not found"
      });
    }

    // Clear all items instead of deleting cart
    cart.items = [];
    await cart.save();

    res.json({
      success: true,
      message: "Cart cleared successfully",
      data: {
        items: [],
        itemCount: 0,
        ...calculateTotals([])
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
