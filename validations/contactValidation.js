const Joi = require("joi");

const createContactSchema = Joi.object({
  name: Joi.string().min(2).required(),
  contactNumber: Joi.string()
    .pattern(/^[6-9]\d{9}$/)
    .required(),
  email: Joi.string().email().required(),
  address: Joi.string().allow("").optional(),
  message: Joi.string().allow("").optional(),
});

module.exports = {
  createContactSchema,
};
