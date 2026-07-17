const express = require('express');
const router = express.Router();
const visiteController = require('../controllers/visite.controller');
const { authenticate } = require('../middleware/auth.middleware');

router.use(authenticate);

router.get('/', visiteController.getAll);
router.get('/filters', visiteController.getFilters);
router.get('/salarie/:salarieId', visiteController.getBySalarie);
router.get('/medecin/:medecinId', visiteController.getByMedecin);
router.get('/:id', visiteController.getById);
router.post('/', visiteController.create);
router.put('/:id', visiteController.update);
router.delete('/:id', visiteController.delete);

module.exports = router;
