const yup = require('yup');

const validate = (schema) => async (req, res, next) => {
    try {
        await schema.validate(req.body, { abortEarly: false });
        return next();
    } catch (err) {
        return res.status(400).json({ error: 'Validation failed', messages: err.errors });
    }
};

module.exports = validate;
