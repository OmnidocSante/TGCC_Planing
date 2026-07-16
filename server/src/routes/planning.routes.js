const express = require('express');
const router = express.Router();
const planningController = require('../controllers/planning.controller');
const { authenticate } = require('../middleware/auth.middleware');

router.use(authenticate);

router.get('/', planningController.getAll);
router.get('/:id', planningController.getById);
router.post('/generate', planningController.generate);
router.post('/generate-by-chantier', planningController.generateByChantier);
router.put('/:id', planningController.update);
router.delete('/:id', planningController.delete);
router.post('/:id/validate', planningController.validate);

module.exports = router;
