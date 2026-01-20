const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const routes = require('./routes');

const path = require('path');
const app = express();

// Middlewares
app.use(helmet({
    crossOriginResourcePolicy: false,
}));
app.use(cors({ origin: true, credentials: true }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use('/uploads', express.static(path.resolve(__dirname, '..', 'uploads')));

// Routes
app.use('/api/v1', routes);

// Error Handler
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).json({ error: 'Internal Server Error' });
});

const { User } = require('./models');



module.exports = app;
