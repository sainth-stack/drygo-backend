const express = require("express");
const {
  createContact,
  getAllContacts,
  updateContactStatus,
} = require("../controllers/contactController.js");
// import { protect, adminOnly } from "../middlewares/auth.middleware.js";

const router = express.Router();

// Public
router.post("/", createContact);

// Admin
router.get("/", getAllContacts);
router.patch("/:id/status", updateContactStatus);

module.exports = router;


// protect, adminOnly and 'protect, adminOnly, ' router.get("/", protect, adminOnly, getAllContacts);
//router.patch("/:id/status", protect, adminOnly, updateContactStatus);
