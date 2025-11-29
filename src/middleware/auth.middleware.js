const jwt = require('jsonwebtoken');

module.exports = (req, res, next) => {
    const authHeader = req.headers.authorization;

    if (!authHeader) {
        return res.status(401).json({ error: 'Token not provided' });
    }

    const [, token] = authHeader.split(' ');

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        req.userId = decoded.id;
        req.userRole = decoded.role; // Assuming we have roles
        return next();
    } catch (err) {
        return res.status(401).json({ error: 'Token invalid' });
    }
};
