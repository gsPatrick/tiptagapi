const jwt = require('jsonwebtoken');

const authMiddleware = (req, res, next) => {
    const authHeader = req.headers.authorization;
    const integrationSecret = req.headers['x-integration-secret'];

    // Bypass for Integration
    if (integrationSecret && integrationSecret === process.env.INTEGRATION_SECRET) {
        req.userId = 'integration-system';
        req.userRole = 'admin'; // Grant admin access for integration
        return next();
    }

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

const roleMiddleware = (roles) => {
    return (req, res, next) => {
        if (!req.userRole) {
            return res.status(403).json({ error: 'Access denied. No role found.' });
        }
        if (!roles.includes(req.userRole)) {
            return res.status(403).json({ error: 'Access denied' });
        }
        next();
    };
};

module.exports = { authMiddleware, roleMiddleware };
