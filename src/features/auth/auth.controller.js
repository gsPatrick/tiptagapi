const authService = require('./auth.service');

class AuthController {
    async login(req, res) {
        try {
            const { email, password } = req.body;
            const { user, token } = await authService.login(email, password);
            return res.json({ user, token });
        } catch (err) {
            return res.status(401).json({ error: err.message });
        }
    }
}

module.exports = new AuthController();
