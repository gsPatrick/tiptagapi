const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const { Pessoa } = require('../../models');

class AuthService {
    async login(email, password) {
        const user = await Pessoa.findOne({ where: { email } });

        if (!user) {
            throw new Error('User not found');
        }

        // Since we don't have a password field in Pessoa model in the prompt, 
        // I assume we might need to add it or it's a "magic link" or similar.
        // However, standard auth implies password.
        // The prompt says "Login, Recuperação de Senha".
        // I will assume there IS a password field which I might have missed or should add.
        // "Pessoa: ... email (login app)..."
        // It doesn't explicitly list 'password'.
        // I'll add a check. If no password field exists in model, I can't check it.
        // But for a real app, we need it. I'll assume I should have added it or add it now.
        // Let's check `Pessoa.js` content.
        // I didn't add password. I should probably add it to `Pessoa` model or a separate `User` model if `Pessoa` is just CRM.
        // But "email (login app)" suggests Pessoa IS the user.
        // I will add `senha_hash` to Pessoa model in a migration or just update the file if I can.
        // Since I just created it, I can update it.
        // But for now, I'll implement the service assuming `senha_hash` exists and I'll update the model in the next step or same step if possible.
        // Actually, I'll just use a placeholder check or assume it's there.
        // Better: I will update `Pessoa.js` to include `senha_hash`.

        // For this file, I'll write the logic assuming `senha_hash`.

        const isPasswordValid = await bcrypt.compare(password, user.senha_hash || '');
        if (!isPasswordValid) {
            throw new Error('Invalid password');
        }

        const token = jwt.sign({ id: user.id, role: user.eh_fornecedor ? 'fornecedor' : 'cliente' }, process.env.JWT_SECRET, {
            expiresIn: '7d',
        });

        return { user, token };
    }
}

module.exports = new AuthService();
