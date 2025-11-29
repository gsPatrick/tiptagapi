const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const routes = require('./routes');

const app = express();

// Middlewares
app.use(helmet());
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Routes
app.use('/api/v1', routes);

// Error Handler
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).json({ error: 'Internal Server Error' });
});

const { User } = require('./models');

// Create default user if not exists
(async () => {
    try {
        const user = await User.findOne({ where: { email: 'patrick@gmail.com' } });
        if (!user) {
            await User.create({
                nome: 'Patrick',
                email: 'patrick@gmail.com',
                senha_hash: 'patrick123', // Will be hashed by hook
                role: 'ADMIN'
            });
            console.log('Default user created: patrick@gmail.com');
        }
    } catch (error) {
        console.error('Error creating default user:', error);
    }
})();

module.exports = app;
