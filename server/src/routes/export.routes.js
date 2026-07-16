const express = require('express');
const router = express.Router();
const exportController = require('../controllers/export.controller');
const { authenticate } = require('../middleware/auth.middleware');

router.use(authenticate);

router.get('/planning/:id/excel', exportController.exportPlanningExcel);
router.get('/planning/:id/pdf', exportController.exportPlanningPdf);
router.get('/planning/:id/chantier/:chantierName/pdf', exportController.exportChantierPdf);
router.get('/visites/excel', exportController.exportVisitesExcel);

module.exports = router;
