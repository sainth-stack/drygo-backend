const mongoose = require("mongoose");

const nutritionItemSchema = new mongoose.Schema(
  {
    nutrient: String,
    per100g: String,
    per5g: String,
    rda: String
  },
  { _id: false }
);

const productNutritionSchema = new mongoose.Schema(
  {
    productId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Product",
      required: true,
      unique: true
    },
    nutritions: [nutritionItemSchema]
  },
  { timestamps: true }
);

module.exports = mongoose.model("ProductNutrition", productNutritionSchema);
