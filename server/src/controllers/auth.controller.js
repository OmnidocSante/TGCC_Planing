const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

const generateToken = (userId) => {
  return jwt.sign({ userId }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || '7d'
  });
};

exports.register = async (req, res, next) => {
  try {
    const { email, password, name, role } = req.body;

    const existingUser = await prisma.user.findUnique({
      where: { email }
    });

    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: 'Cet email est déjà utilisé'
      });
    }

    const hashedPassword = await bcrypt.hash(password, 12);

    const user = await prisma.user.create({
      data: {
        email,
        password: hashedPassword,
        name,
        role: role || 'USER'
      },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        createdAt: true
      }
    });

    const token = generateToken(user.id);

    res.status(201).json({
      success: true,
      message: 'Utilisateur créé avec succès',
      data: { user, token }
    });
  } catch (error) {
    next(error);
  }
};

exports.login = async (req, res, next) => {
  try {
    const { email, password } = req.body;

    console.log('[LOGIN] Tentative de connexion pour:', email);

    if (!email || !password) {
      console.log('[LOGIN] Email ou mot de passe manquant');
      return res.status(400).json({
        success: false,
        message: 'Email et mot de passe requis',
        debug: { email: !!email, password: !!password }
      });
    }

    const user = await prisma.user.findUnique({
      where: { email }
    });

    if (!user) {
      console.log('[LOGIN] Utilisateur non trouvé:', email);
      return res.status(401).json({
        success: false,
        message: 'Utilisateur non trouvé avec cet email',
        debug: { emailSearched: email }
      });
    }

    console.log('[LOGIN] Utilisateur trouvé:', user.email, 'Role:', user.role);

    const isPasswordValid = await bcrypt.compare(password, user.password);

    if (!isPasswordValid) {
      console.log('[LOGIN] Mot de passe incorrect pour:', email);
      return res.status(401).json({
        success: false,
        message: 'Mot de passe incorrect'
      });
    }

    const token = generateToken(user.id);

    console.log('[LOGIN] Connexion réussie pour:', email);

    res.json({
      success: true,
      message: 'Connexion réussie',
      data: {
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role
        },
        token
      }
    });
  } catch (error) {
    console.error('[LOGIN] Erreur:', error.message);
    res.status(500).json({
      success: false,
      message: 'Erreur serveur lors de la connexion',
      debug: { error: error.message }
    });
  }
};

exports.getMe = async (req, res) => {
  res.json({
    success: true,
    data: req.user
  });
};

exports.getUsers = async (req, res, next) => {
  try {
    const users = await prisma.user.findMany({
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        createdAt: true
      },
      orderBy: { createdAt: 'desc' }
    });

    res.json({
      success: true,
      data: users
    });
  } catch (error) {
    next(error);
  }
};

exports.updateUser = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { name, role, password } = req.body;

    const updateData = {};
    if (name) updateData.name = name;
    if (role) updateData.role = role;
    if (password) updateData.password = await bcrypt.hash(password, 12);

    const user = await prisma.user.update({
      where: { id: parseInt(id) },
      data: updateData,
      select: {
        id: true,
        email: true,
        name: true,
        role: true
      }
    });

    res.json({
      success: true,
      message: 'Utilisateur mis à jour',
      data: user
    });
  } catch (error) {
    next(error);
  }
};

exports.deleteUser = async (req, res, next) => {
  try {
    const { id } = req.params;

    await prisma.user.delete({
      where: { id: parseInt(id) }
    });

    res.json({
      success: true,
      message: 'Utilisateur supprimé'
    });
  } catch (error) {
    next(error);
  }
};
