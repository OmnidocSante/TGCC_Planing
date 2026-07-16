const express = require('express');
const router = express.Router();
const importController = require('../controllers/import.controller');
const { authenticate } = require('../middleware/auth.middleware');
const upload = require('../middleware/upload.middleware');

router.use(authenticate);

router.post('/historique', upload.single('file'), importController.importHistorique);
router.post('/client', upload.single('file'), importController.importClient);
router.get('/history', importController.getImportHistory);

module.exports = router;
