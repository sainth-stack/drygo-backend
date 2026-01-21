const Product = require("../models/productModels/ProductModel");
const ProductNutrition = require("../models/productModels/ProductNutritionModel");

// ✅ GET ALL PRODUCTS
exports.getAllProducts = async (req, res) => {
  try {
    // Check MongoDB connection
    const mongoose = require("mongoose");
    if (mongoose.connection.readyState !== 1) {
      return res.status(500).json({
        success: false,
        message: "Database not connected. Connection state: " + mongoose.connection.readyState
      });
    }

    // Fetch all products
    const products = await Product.find({});
    
    // Get all product IDs
    const productIds = products.map(product => product._id);
    
    // Fetch all related nutritions in one efficient query
    const allNutritions = await ProductNutrition.find({
      productId: { $in: productIds }
    });
    
    // Create a map for quick lookup: productId -> nutritions array
    const nutritionMap = {};
    allNutritions.forEach(nutrition => {
      nutritionMap[nutrition.productId.toString()] = nutrition.nutritions || [];
    });
    
    // Attach nutritions to each product
    const productsWithNutritions = products.map(product => {
      const productObj = product.toObject();
      productObj.nutritions = nutritionMap[product._id.toString()] || [];
      return productObj;
    });

    res.json({
      success: true,
      data: productsWithNutritions
    });
  } catch (error) {
    console.error("Error in getAllProducts:", error);
    res.status(500).json({
      success: false,
      message: error.message,
      error: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
};

// CREATE PRODUCT
exports.createProduct = async (req, res) => {
  try {
    const product = await Product.create(req.body);
    res.status(201).json({
      success: true,
      data: product
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message
    });
  }
};

// GET PRODUCT BY ID
exports.getProductById = async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);
    if (!product)
      return res.status(404).json({ message: "Product not found" });

    res.json({ success: true, data: product });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

// CREATE / UPDATE NUTRITION
// Route: POST /api/products/:productId/nutrition
exports.upsertProductNutrition = async (req, res) => {
  try {
    // Get productId from URL parameter (RESTful approach)
    const { productId } = req.params;
    const { nutritions } = req.body;

    // Validation
    if (!productId) {
      return res.status(400).json({
        success: false,
        message: "Product ID is required in URL parameter"
      });
    }

    if (!nutritions || !Array.isArray(nutritions)) {
      return res.status(400).json({
        success: false,
        message: "Nutritions must be an array"
      });
    }

    // Validate product exists
    const product = await Product.findById(productId);
    if (!product) {
      return res.status(404).json({
        success: false,
        message: "Product not found"
      });
    }

    // Validate nutrition items structure
    for (let i = 0; i < nutritions.length; i++) {
      const item = nutritions[i];
      if (!item.nutrient) {
        return res.status(400).json({
          success: false,
          message: `Nutrition item at index ${i} is missing 'nutrient' field`
        });
      }
    }

    // Create or update nutrition
    const nutrition = await ProductNutrition.findOneAndUpdate(
      { productId },
      { nutritions },
      { new: true, upsert: true }
    );

    res.json({
      success: true,
      message: "Product nutrition saved successfully",
      data: nutrition
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message || "Failed to save nutrition data"
    });
  }
};

// GET NUTRITION
exports.getProductNutrition = async (req, res) => {
  try {
    const nutrition = await ProductNutrition.findOne({
      productId: req.params.id
    });

    res.json({
      success: true,
      data: nutrition?.nutritions || []
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// GET PRODUCT + NUTRITION
exports.getProductWithNutrition = async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);
    const nutrition = await ProductNutrition.findOne({
      productId: req.params.id
    });

    res.json({
      success: true,
      data: {
        product,
        nutritions: nutrition?.nutritions || []
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// DELETE PRODUCT + NUTRITION
exports.deleteProduct = async (req, res) => {
  try {
    const productId = req.params.id;

    // delete product
    const product = await Product.findByIdAndDelete(productId);

    if (!product) {
      return res.status(404).json({
        success: false,
        message: "Product not found"
      });
    }

    // delete related nutrition
    await ProductNutrition.findOneAndDelete({ productId });

    res.json({
      success: true,
      message: "Product and nutrition deleted successfully"
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

