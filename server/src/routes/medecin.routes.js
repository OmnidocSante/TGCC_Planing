const express = require('express');
const router = express.Router();
const medecinController = require('../controllers/medecin.controller');
const { authenticate } = require('../middleware/auth.middleware');

router.use(authenticate);

router.get('/', medecinController.getAll);
router.get('/:id', medecinController.getById);
router.post('/', medecinController.create);
router.put('/:id', medecinController.update);
router.delete('/:id', medecinController.delete);
router.get('/ville/:ville', medecinController.getByVille);

module.exports = router;
