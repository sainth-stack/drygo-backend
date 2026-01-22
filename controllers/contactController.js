const Contact = require("../models/ContactModel.js");
const { createContactSchema } = require("../validations/contactValidation.js");

/**
 * POST /api/contact
 */
const createContact = async (req, res) => {
  try {
    const { error, value } = createContactSchema.validate(req.body);

    if (error) {
      return res.status(400).json({
        success: false,
        message: error.details[0].message,
      });
    }

    const contact = await Contact.create(value);

    res.status(201).json({
      success: true,
      message: "Contact request submitted successfully",
      data: contact,
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
};

const getAllContacts = async (req, res) => {
  try {
    const contacts = await Contact.find().sort({ createdAt: -1 });

    res.json({
      success: true,
      data: contacts,
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
};

const updateContactStatus = async (req, res) => {
  try {
    const { status } = req.body;

    const contact = await Contact.findByIdAndUpdate(
      req.params.id,
      { status },
      { new: true }
    );

    if (!contact) {
      return res.status(404).json({
        success: false,
        message: "Contact not found",
      });
    }

    res.json({
      success: true,
      message: "Status updated",
      data: contact,
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
};

module.exports = {
  createContact,
  getAllContacts,
  updateContactStatus,
};
