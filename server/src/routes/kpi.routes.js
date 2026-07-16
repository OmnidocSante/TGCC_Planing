const express = require('express');
const router = express.Router();
const kpiController = require('../controllers/kpi.controller');
const { authenticate } = require('../middleware/auth.middleware');

router.use(authenticate);

router.get('/stats', kpiController.getStats);
router.get('/visites-par-mois', kpiController.getVisitesParMois);
router.get('/visites-par-ville', kpiController.getVisitesParVille);
router.get('/salaries-stats', kpiController.getSalariesStats);
router.get('/medecins-performance', kpiController.getMedecinsPerformance);
router.get('/honoraires-stats', kpiController.getHonorairesStats);

module.exports = router;
