const express = require('express');
const router = express.Router();
const honoraireController = require('../controllers/honoraire.controller');
const { authenticate } = require('../middleware/auth.middleware');

router.use(authenticate);

router.get('/', honoraireController.getAll);
router.get('/stats', honoraireController.getStatsByMedecin);
router.post('/', honoraireController.create);
router.post('/generate/:planningId', honoraireController.generateFromPlanning);
router.put('/:id/statut', honoraireController.updateStatut);
router.put('/bulk-statut', honoraireController.bulkUpdateStatut);
router.delete('/:id', honoraireController.delete);

module.exports = router;
