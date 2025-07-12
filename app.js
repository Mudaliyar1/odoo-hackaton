const express = require('express');
const mongoose = require('mongoose');
const session = require('express-session');
const MongoStore = require('connect-mongo');
const methodOverride = require('method-override');
const path = require('path');
require('dotenv').config();

const app = express();

// Database connection
mongoose.connect(process.env.MONGODB_URI)
  .then(() => console.log('Connected to MongoDB'))
  .catch(err => console.error('MongoDB connection error:', err));

// Middleware
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(methodOverride('_method'));
app.use(express.static(path.join(__dirname, 'public')));

// Session configuration
app.use(session({
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  store: MongoStore.create({
    mongoUrl: process.env.MONGODB_URI
  }),
  cookie: {
    secure: false, // Set to true in production with HTTPS
    maxAge: 24 * 60 * 60 * 1000 // 24 hours
  }
}));

// View engine setup
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Make user available in all templates
app.use((req, res, next) => {
  res.locals.user = req.session.user || null;
  res.locals.isAdmin = req.session.user && req.session.user.role === 'admin';
  next();
});

// Routes
const authRoutes = require('./routes/auth');
const userRoutes = require('./routes/users');
const swapRoutes = require('./routes/swaps');
const adminRoutes = require('./routes/admin');
const pageRoutes = require('./routes/pages');

app.use('/auth', authRoutes);
app.use('/users', userRoutes);
app.use('/swaps', swapRoutes);
app.use('/admin', adminRoutes);
app.use('/', pageRoutes);

// Home route
app.get('/', async (req, res) => {
  try {
    const User = require('./models/User');
    const recentUsers = await User.find({ 
      isPublic: true, 
      isBanned: false 
    })
    .select('name location skillsOffered profilePhoto')
    .limit(6)
    .sort({ createdAt: -1 });

    res.render('index', {
      title: 'Skill Swap Platform',
      recentUsers,
      isHomepage: true
    });
  } catch (error) {
    console.error('Home page error:', error);
    res.render('index', {
      title: 'Skill Swap Platform',
      recentUsers: [],
      isHomepage: true
    });
  }
});

// 404 handler
app.use((req, res) => {
  res.status(404).render('404', { title: 'Page Not Found' });
});

// Error handler
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).render('error', { 
    title: 'Server Error',
    error: process.env.NODE_ENV === 'development' ? err : {}
  });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Visit: http://localhost:${PORT}`);
});

module.exports = app;
