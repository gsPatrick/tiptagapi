const jwt = require('jsonwebtoken');
const { User } = require('../../models');

class AuthService {
    async login(email, password) {
        const user = await User.findOne({ where: { email } });

        if (!user) {
            throw new Error('User not found');
        }

        const isPasswordValid = await user.checkPassword(password);
        if (!isPasswordValid) {
            throw new Error('Invalid password');
        }

        const token = jwt.sign({ id: user.id, role: user.role }, process.env.JWT_SECRET, {
            expiresIn: '7d',
        });

        return { user, token };
    }
}

module.exports = new AuthService();
