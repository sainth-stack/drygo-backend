const mongoose = require("mongoose");

const productSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true
    },
    description: {
      type: String
    },
    price: {
      type: String, // keeping string as per UI requirement
      required: true
    },
    image: {
      type: String
    },
    link: {
      type: String
    },
    badge: {
      type: String
    },
    badgeVariant: {
      type: String,
      enum: ["default", "gold", "leaf", "success", "warning", "beetroot", "banana"],
      default: "default"
    }
  },
  { timestamps: true }
);

// Virtual field to populate nutritions
productSchema.virtual("nutritions", {
  ref: "ProductNutrition",
  localField: "_id",
  foreignField: "productId",
  justOne: true
});

// Enable virtual fields in JSON output
productSchema.set("toJSON", { virtuals: true });
productSchema.set("toObject", { virtuals: true });

module.exports = mongoose.model("Product", productSchema);
