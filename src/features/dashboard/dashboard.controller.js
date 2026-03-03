const dashboardService = require('./dashboard.service');

class DashboardController {
    async getResumo(req, res) {
        try {
            const data = await dashboardService.getResumo();
            return res.json(data);
        } catch (err) {
            return res.status(500).json({ error: err.message });
        }
    }
}

module.exports = new DashboardController();
