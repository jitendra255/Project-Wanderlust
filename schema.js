const Joi = require('joi');
const { CATEGORY_LABELS, PRICE_UNITS } = require('./utils/categories.js');

// Indian mobile/landline, optionally +91 prefixed. Deliberately permissive -
// a wrong-format rejection is more annoying than a slightly odd number.
const PHONE = Joi.string().pattern(/^[+0-9][0-9\s-]{6,17}$/).allow("", null);

module.exports.listingschema = Joi.object({
    listing: Joi.object({
        title: Joi.string().required(),
        description: Joi.string().required(),
        category: Joi.string().valid(...CATEGORY_LABELS).required(),
        location: Joi.string().required(),
        landmark: Joi.string().allow("", null),
        country: Joi.string().allow("", null),
        price: Joi.number().min(0).allow("", null),
        priceUnit: Joi.string().valid(...PRICE_UNITS).allow("", null),
        deposit: Joi.number().min(0).allow("", null),
        phone: PHONE,
        whatsapp: PHONE,
        timings: Joi.string().allow("", null),
        vegOnly: Joi.any().custom((v) => v === "on" || v === true || v === "true"),
        gender: Joi.string().valid("Boys", "Girls", "Co-ed", "").allow("", null),
        amenities: Joi.alternatives()
            .try(Joi.array().items(Joi.string().allow("")), Joi.string().allow(""))
            .allow(null),
        image: Joi.string().allow("", null),
    }).required()
})

module.exports.reviewschema = Joi.object({
    review: Joi.object({
        rating: Joi.number().required().min(1).max(5),
        comment: Joi.string().required(),
    }).required()
})

module.exports.enquiryschema = Joi.object({
    enquiry: Joi.object({
        message: Joi.string().min(5).max(1000).required(),
    }).required()
})
