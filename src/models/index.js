const fs = require('fs');
const path = require('path');
const Sequelize = require('sequelize');
const process = require('process');
const basename = path.basename(__filename);
const env = process.env.NODE_ENV || 'development';
const config = require('../config/database.js')[env];
const db = {};

let sequelize;
if (config.use_env_variable) {
    sequelize = new Sequelize(process.env[config.use_env_variable], config);
} else {
    sequelize = new Sequelize(config.database, config.username, config.password, config);
}

// Helper to recursively find models in subdirectories
const loadModels = (dir) => {
    fs.readdirSync(dir).forEach((file) => {
        const fullPath = path.join(dir, file);
        const stat = fs.statSync(fullPath);

        if (stat.isDirectory()) {
            loadModels(fullPath);
        } else if (
            file.indexOf('.') !== 0 &&
            file !== basename &&
            file.slice(-3) === '.js' &&
            file.indexOf('.test.js') === -1
        ) {
            const model = require(fullPath)(sequelize, Sequelize.DataTypes);
            db[model.name] = model;
        }
    });
};

// Start loading from the current directory (src/models)
// Note: We need to handle the fact that models might be in subfolders if we organize them that way,
// but the prompt asked to create files in src/models/.
// If we decide to group them in subfolders later, the recursive function helps.
// For now, we will assume they are flat in src/models/ or in subfolders.
// However, standard sequelize init puts them flat.
// Let's stick to flat for now as per "Crie os arquivos em src/models/" instruction,
// but I'll keep the recursive logic just in case or simple readdir if flat.

// Actually, the prompt says "Crie os arquivos em src/models/".
// It doesn't explicitly say subfolders, but "Group A", "Group B" suggests logical grouping.
// I will implement flat files for simplicity unless the user asked for folders.
// "Pastas por domínio de negócio" was for features/, not necessarily models/.
// But "src/models/ # Todos os arquivos de models" implies they are there.

fs
    .readdirSync(__dirname)
    .filter(file => {
        return (
            file.indexOf('.') !== 0 &&
            file !== basename &&
            file.slice(-3) === '.js' &&
            file.indexOf('.test.js') === -1
        );
    })
    .forEach(file => {
        const model = require(path.join(__dirname, file))(sequelize, Sequelize.DataTypes);
        db[model.name] = model;
    });

Object.keys(db).forEach(modelName => {
    if (db[modelName].associate) {
        db[modelName].associate(db);
    }
});

db.sequelize = sequelize;
db.Sequelize = Sequelize;

module.exports = db;
