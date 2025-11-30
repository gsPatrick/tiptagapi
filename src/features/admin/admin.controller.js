const adminService = require('./admin.service');

class AdminController {
    // Users
    async createUser(req, res) {
        try {
            const user = await adminService.createUser(req.body);
            return res.status(201).json({ message: 'User created', userId: user.id });
        } catch (err) {
            return res.status(400).json({ error: err.message });
        }
    }

    async getAllUsers(req, res) {
        try {
            const users = await adminService.getAllUsers();
            return res.json(users);
        } catch (err) {
            return res.status(500).json({ error: err.message });
        }
    }

    // Configs
    async getAllConfigs(req, res) {
        try {
            const configs = await adminService.getAllConfigs();
            return res.json(configs);
        } catch (err) {
            return res.status(500).json({ error: err.message });
        }
    }

    async updateConfig(req, res) {
        try {
            const { chave } = req.params;
            const { valor } = req.body;
            const config = await adminService.updateConfig(chave, valor);
            return res.json(config);
        } catch (err) {
            return res.status(400).json({ error: err.message });
        }
    }

    async uploadLogo(req, res) {
        try {
            if (!req.file) {
                return res.status(400).json({ error: 'No file uploaded' });
            }
            // Construct full URL
            const protocol = req.protocol;
            const host = req.get('host');
            const fileUrl = `${protocol}://${host}/uploads/${req.file.filename}`;

            // Update config directly
            await adminService.updateConfig('SYSTEM_LOGO', fileUrl);

            return res.json({ url: fileUrl });
        } catch (err) {
            return res.status(500).json({ error: err.message });
        }
    }

    async getPublicConfigs(req, res) {
        try {
            const configs = await adminService.getAllConfigs();
            // Filter only public configurations
            const publicKeys = ['SYSTEM_COLOR_PRIMARY', 'SYSTEM_LOGO'];
            const publicConfigs = configs.filter(c => publicKeys.includes(c.chave));
            return res.json(publicConfigs);
        } catch (err) {
            return res.status(500).json({ error: err.message });
        }
    }
}

module.exports = new AdminController();
