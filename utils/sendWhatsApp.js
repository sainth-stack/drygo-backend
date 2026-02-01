const path = require("path");
const dotenv = require("dotenv");

// Ensure .env is loaded (in case this module loads before index.js)
dotenv.config({ path: path.join(__dirname, "..", ".env") });

const twilio = require("twilio");

let _client = null;

function getTwilioClient() {
  if (_client) return _client;
  const sid = process.env.TWILIO_ACCOUNT_SID;
  const token = process.env.TWILIO_AUTH_TOKEN;
  if (sid && token) {
    _client = twilio(sid, token);
  }
  return _client;
}

/**
 * Format shipping address for WhatsApp message
 */
const formatAddress = (addr) => {
  if (!addr) return "N/A";
  const parts = [
    addr.line1,
    addr.line2,
    addr.city,
    addr.state,
    addr.pincode,
    addr.country || "India"
  ].filter(Boolean);
  return parts.join(", ");
};

/**
 * Format order items for WhatsApp message
 */
const formatOrderItems = (items) => {
  if (!items || items.length === 0) return "No items";
  return items
    .map(
      (item) =>
        `• ${item.name} x${item.quantity} - ₹${(item.price * item.quantity).toFixed(2)}`
    )
    .join("\n");
};

/**
 * Send order details to business WhatsApp number
 * @param {Object} order - Order document (plain object or Mongoose document)
 * @returns {Promise<Object|null>} Twilio message object or null if skipped/failed
 */
const sendOrderWhatsApp = async (order) => {
  const client = getTwilioClient();
  if (!client) {
    console.warn(
      "⚠️  WhatsApp skipped: Add TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN to .env (see env.example)"
    );
    return null;
  }

  const orderObj = order.toObject ? order.toObject() : order;
  const businessNumber =
    (process.env.BUSINESS_WHATSAPP_NUMBER || "+916362185820").replace(/\s/g, "") ||
    "+916362185820";
  const fromNumber =
    process.env.TWILIO_WHATSAPP_FROM || "whatsapp:+14155238886";

  const addr = formatAddress(orderObj.shippingAddress);
  const itemsText = formatOrderItems(orderObj.items);

  const message = `🛒 *New Order - DryGo*

📋 *Order ID:* ${orderObj.orderNumber}

👤 *Customer Details*
Name: ${orderObj.customerName}
Email: ${orderObj.customerEmail}
Phone: ${orderObj.customerPhone}

📍 *Shipping Address*
${addr}

📦 *Items*
${itemsText}

💰 *Payment*
Method: ${orderObj.paymentMethod.toUpperCase()}
Subtotal: ₹${orderObj.subtotal?.toFixed(2) || "0.00"}
Shipping: ₹${orderObj.shipping?.toFixed(2) || "0.00"}
GST: ₹${orderObj.gst?.toFixed(2) || "0.00"}
${orderObj.discount > 0 ? `Discount: -₹${orderObj.discount?.toFixed(2) || "0.00"}\n` : ""}*Total: ₹${orderObj.totalAmount?.toFixed(2) || "0.00"}*
${orderObj.couponCode ? `Coupon: ${orderObj.couponCode}` : ""}

📅 Est. Delivery: ${orderObj.deliveryEstimate || "N/A"}
`;

  try {
    const toWhatsApp = businessNumber.startsWith("whatsapp:")
      ? businessNumber
      : `whatsapp:${businessNumber}`;
    const from = fromNumber.startsWith("whatsapp:") ? fromNumber : `whatsapp:${fromNumber}`;

    const result = await client.messages.create({
      from,
      to: toWhatsApp,
      body: message
    });

    console.log(`✅ WhatsApp order notification sent to ${toWhatsApp} (Order: ${orderObj.orderNumber})`);
    return result;
  } catch (err) {
    console.error("❌ WhatsApp send failed:", err.message);
    return null;
  }
};

module.exports = { sendOrderWhatsApp };
