# TGCC - Planning des Visites Médicales

Application web de planification des visites médicales pour les médecins de travail.

![Version](https://img.shields.io/badge/version-1.0.0-blue.svg)
![Node](https://img.shields.io/badge/node-18+-green.svg)
![MySQL](https://img.shields.io/badge/MySQL-8.0-orange.svg)

## Fonctionnalités

### Gestion des Visites
- **Import Excel** : Import de l'historique des visites et du fichier client
- **Règle des 12 mois** : Détection automatique des salariés à planifier
- **Planification par chantier** : Organisation des visites par site/chantier
- **Calendrier sophistiqué** : Vue agenda des planifications
- **Export** : Excel et PDF des plannings

### Gestion des Ressources
- **Salariés** : CRUD complet avec recherche par matricule et pagination
- **Médecins** : Attribution automatique ou manuelle par ville
- **Chantiers** : Regroupement par ville pour faciliter le tri

### Module Honoraires
- **Tarification flexible** : Par visite au chantier ou par collaborateur examiné
- **Suivi des paiements** : Statuts EN_ATTENTE, VALIDE, PAYE
- **Génération automatique** : Calcul des honoraires depuis les plannings validés

### KPI et Statistiques
- **Dashboard** : Vue d'ensemble avec indicateurs clés
- **Graphiques** : Évolution des visites, répartition par statut, par ville
- **Taux de couverture** : Suivi des objectifs de visite

### Sécurité
- **Authentification JWT** : Tokens sécurisés avec expiration
- **Rate Limiting** : Protection contre les attaques par force brute
- **Validation des entrées** : Sanitization et validation des données
- **Headers sécurisés** : Configuration Helmet.js

## Prérequis

- Node.js 18+
- MySQL 8.0
- npm ou yarn

## Installation

### 1. Cloner le projet

```bash
git clone https://github.com/OmnidocSante/TGCC_Planing.git
cd TGCC_Planing
```

### 2. Base de données MySQL

```sql
CREATE DATABASE tgcc_planning CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
```

### 3. Configuration

```bash
# Copier le fichier d'environnement
cd server
cp .env.example .env

# Modifier .env avec vos paramètres
DATABASE_URL="mysql://USER:PASSWORD@HOST:3306/tgcc_planning"
JWT_SECRET="votre-secret-jwt-securise-64-caracteres-minimum"
```

### 4. Installation des dépendances

```bash
# Depuis la racine du projet
npm install
```

### 5. Initialisation de la base de données

```bash
cd server

# Générer le client Prisma
npx prisma generate

# Créer les tables
npx prisma migrate dev --name init

# Insérer les données initiales (admin + médecins)
npm run seed
```

### 6. Démarrage

```bash
# Depuis la racine du projet
npm run dev
```

- **Frontend** : http://localhost:3000
- **Backend API** : http://localhost:8500

### Compte admin
Contactez l'administrateur pour obtenir vos identifiants de connexion.

## Structure du Projet

```
TGCC-Planning/
├── client/                     # Frontend React
│   ├── src/
│   │   ├── components/         # Composants réutilisables
│   │   │   └── Layout.jsx      # Navigation principale
│   │   ├── context/            # Contextes React
│   │   │   └── AuthContext.jsx # Gestion authentification
│   │   ├── pages/              # Pages de l'application
│   │   │   ├── Dashboard.jsx   # Tableau de bord
│   │   │   ├── Planning.jsx    # Génération planning
│   │   │   ├── PlanningDetail.jsx
│   │   │   ├── PlanningCalendar.jsx
│   │   │   ├── Visites.jsx     # Gestion des visites
│   │   │   ├── Salaries.jsx    # Gestion des salariés
│   │   │   ├── Medecins.jsx    # Gestion des médecins
│   │   │   ├── Honoraires.jsx  # Module facturation
│   │   │   ├── KPI.jsx         # Indicateurs performance
│   │   │   ├── Import.jsx      # Import fichiers Excel
│   │   │   ├── Users.jsx       # Gestion utilisateurs
│   │   │   └── Login.jsx       # Authentification
│   │   └── services/
│   │       └── api.js          # Client HTTP Axios
│   └── package.json
│
├── server/                     # Backend Node.js
│   ├── prisma/
│   │   ├── schema.prisma       # Schéma base de données
│   │   └── seed.js             # Données initiales
│   ├── src/
│   │   ├── controllers/        # Logique métier
│   │   │   ├── auth.controller.js
│   │   │   ├── visite.controller.js
│   │   │   ├── planning.controller.js
│   │   │   ├── honoraire.controller.js
│   │   │   ├── kpi.controller.js
│   │   │   └── ...
│   │   ├── middleware/         # Middlewares
│   │   │   ├── auth.middleware.js
│   │   │   ├── upload.middleware.js
│   │   │   └── validate.middleware.js
│   │   ├── routes/             # Routes API
│   │   └── index.js            # Point d'entrée serveur
│   ├── uploads/                # Fichiers uploadés
│   ├── .env.example            # Template configuration
│   └── package.json
│
├── package.json                # Scripts racine
└── README.md
```

## API Endpoints

### Authentification
| Méthode | Endpoint | Description |
|---------|----------|-------------|
| POST | `/api/auth/login` | Connexion |
| POST | `/api/auth/register` | Inscription |
| GET | `/api/auth/me` | Utilisateur courant |
| GET | `/api/auth/users` | Liste utilisateurs (admin) |

### Salariés
| Méthode | Endpoint | Description |
|---------|----------|-------------|
| GET | `/api/salaries` | Liste paginée |
| GET | `/api/salaries/search?q=...` | Recherche |
| POST | `/api/salaries` | Créer |
| PUT | `/api/salaries/:id` | Modifier |
| DELETE | `/api/salaries/:id` | Supprimer |

### Médecins
| Méthode | Endpoint | Description |
|---------|----------|-------------|
| GET | `/api/medecins` | Liste |
| GET | `/api/medecins/ville/:ville` | Par ville |
| POST | `/api/medecins` | Créer |
| PUT | `/api/medecins/:id` | Modifier |

### Visites
| Méthode | Endpoint | Description |
|---------|----------|-------------|
| GET | `/api/visites` | Liste avec filtres |
| GET | `/api/visites/:id` | Détail |
| POST | `/api/visites` | Créer |
| PUT | `/api/visites/:id` | Modifier |
| DELETE | `/api/visites/:id` | Supprimer |

### Planning
| Méthode | Endpoint | Description |
|---------|----------|-------------|
| GET | `/api/planning` | Liste des plannings |
| GET | `/api/planning/:id` | Détail planning |
| POST | `/api/planning/generate` | Générer planning |
| POST | `/api/planning/generate-by-chantier` | Générer par chantier |
| POST | `/api/planning/:id/validate` | Valider planning |
| DELETE | `/api/planning/:id` | Supprimer |

### Import
| Méthode | Endpoint | Description |
|---------|----------|-------------|
| POST | `/api/import/historique` | Import historique visites |
| POST | `/api/import/client` | Import fichier client |
| GET | `/api/import/history` | Historique imports |

### Export
| Méthode | Endpoint | Description |
|---------|----------|-------------|
| GET | `/api/export/planning/:id/excel` | Export Excel |
| GET | `/api/export/planning/:id/pdf` | Export PDF |
| GET | `/api/export/chantier/:id/:chantier/pdf` | PDF par chantier |

### Honoraires
| Méthode | Endpoint | Description |
|---------|----------|-------------|
| GET | `/api/honoraires` | Liste honoraires |
| GET | `/api/honoraires/stats` | Statistiques |
| POST | `/api/honoraires/generate/:planningId` | Générer honoraires |
| PUT | `/api/honoraires/:id` | Modifier |
| PUT | `/api/honoraires/bulk-status` | Maj statut en masse |

### KPI
| Méthode | Endpoint | Description |
|---------|----------|-------------|
| GET | `/api/kpi/overview` | Vue d'ensemble |
| GET | `/api/kpi/visites` | Stats visites |
| GET | `/api/kpi/medecins` | Stats médecins |
| GET | `/api/kpi/evolution` | Évolution temporelle |

## Règles Métier

### Règle des 12 mois
Un salarié doit avoir une visite médicale tous les **12 mois** :
1. Si dernière visite > 12 mois → **À planifier**
2. Si dernière visite ≤ 12 mois → **À jour**
3. Si aucune visite → **À planifier**

### Tarification Médecins
Deux modes de facturation :
- **PAR_VISITE** : Tarif fixe par visite à un chantier
- **PAR_EXAMEN** : Tarif par collaborateur examiné

## Technologies

### Frontend
- React 18
- Vite
- TailwindCSS
- Recharts (graphiques)
- Lucide Icons
- React Hot Toast
- Axios

### Backend
- Node.js / Express
- Prisma ORM
- MySQL 8.0
- JWT (jsonwebtoken)
- Bcrypt.js
- Multer (uploads)
- XLSX (Excel)
- PDFKit (PDF)
- Helmet (sécurité)
- Express Rate Limit

## Sécurité

L'application implémente plusieurs mesures de sécurité :

- **Helmet.js** : Headers HTTP sécurisés
- **Rate Limiting** : 10 tentatives / 15 min sur login
- **CORS** : Origines autorisées configurables
- **JWT** : Tokens avec expiration (7 jours par défaut)
- **Bcrypt** : Hashage des mots de passe (12 rounds)
- **Validation** : express-validator sur les entrées

## Configuration Production

1. Mettre `NODE_ENV=production` dans `.env`
2. Configurer `ALLOWED_ORIGINS` avec le domaine de production
3. Utiliser HTTPS (certificat SSL)
4. Configurer des backups automatiques de la BDD

## Contribution

Projet interne OmnidocSanté / TGCC.

## Licence

Propriétaire - Tous droits réservés.
