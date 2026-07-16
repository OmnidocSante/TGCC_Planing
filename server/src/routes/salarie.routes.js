const express = require('express');
const router = express.Router();
const salarieController = require('../controllers/salarie.controller');
const { authenticate } = require('../middleware/auth.middleware');

router.use(authenticate);

router.get('/', salarieController.getAll);
router.get('/search', salarieController.search);
router.get('/:id', salarieController.getById);
router.get('/matricule/:matricule', salarieController.getByMatricule);
router.post('/', salarieController.create);
router.put('/:id', salarieController.update);
router.delete('/:id', salarieController.delete);

module.exports = router;
