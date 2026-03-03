const { User, sequelize } = require('./src/models');

async function checkUser() {
    try {
        await sequelize.authenticate();
        console.log('DB Connected');

        const user = await User.findOne({ where: { email: 'Nos.ecolaborativo@gmail.com' } });
        if (user) {
            console.log('User FOUND:', user.toJSON());
        } else {
            console.log('User NOT FOUND');
        }
    } catch (err) {
        console.error('Error:', err);
    } finally {
        await sequelize.close();
    }
}

checkUser();
