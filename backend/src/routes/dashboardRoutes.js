const express = require('express');
const router = express.Router();
const { dashboardController } = require('../controllers');
const { verifyToken } = require('../middleware');

router.use(verifyToken);

router.get('/', dashboardController.getDashboardSummary);
router.get('/sla', dashboardController.getSLADashboard);

module.exports = router;
