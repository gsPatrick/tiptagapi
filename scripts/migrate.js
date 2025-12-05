const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const migrationsDir = path.join(__dirname, '../migrations');

if (!fs.existsSync(migrationsDir)) {
    console.log('No migrations directory found.');
    process.exit(0);
}

const files = fs.readdirSync(migrationsDir).sort();

for (const file of files) {
    if (file.endsWith('.js')) {
        console.log(`Running migration: ${file}`);
        try {
            execSync(`node ${path.join(migrationsDir, file)}`, { stdio: 'inherit' });
        } catch (err) {
            console.error(`Error running migration ${file}:`, err);
            process.exit(1);
        }
    }
}
console.log('All migrations completed.');
