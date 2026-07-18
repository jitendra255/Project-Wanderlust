const Joi = require('joi');
const { CATEGORY_LABELS } = require('./utils/categories.js');

module.exports.listingschema = Joi.object({
    listing:Joi.object({
        title:Joi.string().required(),
        description:Joi.string().required(),
        country:Joi.string().required(),
        location:Joi.string().required(),
        price:Joi.number().required().min(0),
        category:Joi.string().valid(...CATEGORY_LABELS).required(),
        image:Joi.string().allow("",null)
    }).required()
})

module.exports.reviewschema=Joi.object({
    review:Joi.object({
     rating:Joi.number().required().min(1).max(5),
     comment:Joi.string().required(),
    }).required()
})