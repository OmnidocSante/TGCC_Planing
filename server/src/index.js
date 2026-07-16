require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const compression = require('compression');
const morgan = require('morgan');

const authRoutes = require('./routes/auth.routes');
const medecinRoutes = require('./routes/medecin.routes');
const salarieRoutes = require('./routes/salarie.routes');
const visiteRoutes = require('./routes/visite.routes');
const importRoutes = require('./routes/import.routes');
const planningRoutes = require('./routes/planning.routes');
const exportRoutes = require('./routes/export.routes');
const dashboardRoutes = require('./routes/dashboard.routes');
const honoraireRoutes = require('./routes/honoraire.routes');
const kpiRoutes = require('./routes/kpi.routes');

const app = express();

// Trust proxy (required when behind Nginx/reverse proxy)
app.set('trust proxy', 1);

// Security middleware
app.use(helmet({
  contentSecurityPolicy: false,
  crossOriginEmbedderPolicy: false
}));

// Compression
app.use(compression());

// Logging (only in development)
if (process.env.NODE_ENV === 'development') {
  app.use(morgan('dev'));
}

// General rate limiter (no limit on auth for troubleshooting)
const generalLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 200, // 200 requests per minute
  message: { success: false, message: 'Trop de requêtes, réessayez plus tard' },
  validate: { xForwardedForHeader: false }
});

// Apply rate limiter (not on auth routes for now)
app.use('/api', generalLimiter);

// CORS configuration
const allowedOrigins = process.env.ALLOWED_ORIGINS 
  ? process.env.ALLOWED_ORIGINS.split(',').map(o => o.trim())
  : ['http://localhost:3000', 'http://localhost:5173'];

app.use(cors({
  origin: function(origin, callback) {
    // Allow requests with no origin (mobile apps, curl, etc.)
    if (!origin) return callback(null, true);
    
    if (allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      console.log('CORS blocked origin:', origin, 'Allowed:', allowedOrigins);
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true
}));

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Static files for uploads
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/medecins', medecinRoutes);
app.use('/api/salaries', salarieRoutes);
app.use('/api/visites', visiteRoutes);
app.use('/api/import', importRoutes);
app.use('/api/planning', planningRoutes);
app.use('/api/export', exportRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/honoraires', honoraireRoutes);
app.use('/api/kpi', kpiRoutes);

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({
    success: false,
    message: 'Une erreur interne est survenue',
    error: process.env.NODE_ENV === 'development' ? err.message : undefined
  });
});

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`📊 Environment: ${process.env.NODE_ENV}`);
});
