const { validationResult, body, param, query } = require('express-validator');

const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: 'Données invalides',
      errors: errors.array().map(e => ({ field: e.path, message: e.msg }))
    });
  }
  next();
};

const validateLogin = [
  body('email')
    .trim()
    .isEmail()
    .withMessage('Email invalide')
    .normalizeEmail(),
  body('password')
    .isLength({ min: 6 })
    .withMessage('Mot de passe requis (min 6 caractères)'),
  handleValidationErrors
];

const validateRegister = [
  body('email')
    .trim()
    .isEmail()
    .withMessage('Email invalide')
    .normalizeEmail(),
  body('password')
    .isLength({ min: 8 })
    .withMessage('Mot de passe minimum 8 caractères')
    .matches(/[0-9]/)
    .withMessage('Mot de passe doit contenir au moins un chiffre'),
  body('name')
    .trim()
    .isLength({ min: 2, max: 100 })
    .withMessage('Nom requis (2-100 caractères)'),
  body('role')
    .optional()
    .isIn(['ADMIN', 'USER'])
    .withMessage('Rôle invalide'),
  handleValidationErrors
];

const validateVisite = [
  body('salarieId')
    .isInt({ min: 1 })
    .withMessage('ID salarié invalide'),
  body('dateVisite')
    .isISO8601()
    .withMessage('Date de visite invalide'),
  body('medecinId')
    .optional({ nullable: true })
    .isInt({ min: 1 })
    .withMessage('ID médecin invalide'),
  handleValidationErrors
];

const validateMedecin = [
  body('nom')
    .trim()
    .isLength({ min: 2, max: 100 })
    .withMessage('Nom requis (2-100 caractères)'),
  body('email')
    .optional()
    .isEmail()
    .withMessage('Email invalide'),
  body('telephone')
    .optional()
    .matches(/^[0-9+\-\s]+$/)
    .withMessage('Téléphone invalide'),
  handleValidationErrors
];

const validateId = [
  param('id')
    .isInt({ min: 1 })
    .withMessage('ID invalide'),
  handleValidationErrors
];

const validatePagination = [
  query('page')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Page doit être un nombre positif'),
  query('limit')
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage('Limite doit être entre 1 et 100'),
  handleValidationErrors
];

module.exports = {
  handleValidationErrors,
  validateLogin,
  validateRegister,
  validateVisite,
  validateMedecin,
  validateId,
  validatePagination
};
