const express = require('express');
const router = express.Router();
const dashboardController = require('../controllers/dashboard.controller');
const { authenticate } = require('../middleware/auth.middleware');

router.use(authenticate);

router.get('/stats', dashboardController.getStats);
router.get('/visites-par-mois', dashboardController.getVisitesParMois);
router.get('/visites-par-ville', dashboardController.getVisitesParVille);
router.get('/a-planifier', dashboardController.getSalariesAPlanifier);

module.exports = router;
