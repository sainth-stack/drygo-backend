const express = require("express");
const router = express.Router();
const controller = require("../../controllers/productController");

// ✅ GET ALL PRODUCTS (MUST BE FIRST)
router.get("/", controller.getAllProducts);

// Product4
router.post("/", controller.createProduct);

// Nutrition routes (MUST BE BEFORE /:id routes to avoid conflicts)
// POST /api/products/:productId/nutrition - Create/Update nutrition (productId in URL)
router.post("/:productId/nutrition", controller.upsertProductNutrition);
router.get("/:id/nutrition", controller.getProductNutrition);

// Product + Nutrition
router.get("/:id/details", controller.getProductWithNutrition);

// Generic product routes (MUST BE AFTER specific routes)
router.get("/:id", controller.getProductById);
router.delete("/:id", controller.deleteProduct);

module.exports = router;
