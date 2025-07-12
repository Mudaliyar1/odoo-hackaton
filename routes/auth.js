const express = require('express');
const { body, validationResult } = require('express-validator');
const User = require('../models/User');
const { requireGuest, checkBanned } = require('../middleware/auth');

const router = express.Router();

// Apply banned check to all routes
router.use(checkBanned);

// GET /auth/register
router.get('/register', requireGuest, (req, res) => {
  res.render('auth/register', {
    title: 'Register',
    errors: [],
    formData: {}
  });
});

// POST /auth/register
router.post('/register', [
  requireGuest,
  body('name')
    .trim()
    .isLength({ min: 2, max: 100 })
    .withMessage('Name must be between 2 and 100 characters'),
  body('email')
    .isEmail()
    .normalizeEmail()
    .withMessage('Please enter a valid email'),
  body('password')
    .isLength({ min: 6 })
    .withMessage('Password must be at least 6 characters long'),
  body('confirmPassword')
    .custom((value, { req }) => {
      if (value !== req.body.password) {
        throw new Error('Passwords do not match');
      }
      return true;
    })
], async (req, res) => {
  try {
    const errors = validationResult(req);
    
    if (!errors.isEmpty()) {
      return res.render('auth/register', {
        title: 'Register',
        errors: errors.array(),
        formData: req.body
      });
    }

    const { name, email, password } = req.body;

    // Check if user already exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.render('auth/register', {
        title: 'Register',
        errors: [{ msg: 'Email already registered' }],
        formData: req.body
      });
    }

    // Create new user
    const user = new User({
      name,
      email,
      password
    });

    await user.save();

    // Create session
    req.session.user = {
      id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
      isBanned: user.isBanned
    };

    res.redirect('/users/dashboard');
  } catch (error) {
    console.error('Registration error:', error);
    res.render('auth/register', {
      title: 'Register',
      errors: [{ msg: 'Registration failed. Please try again.' }],
      formData: req.body
    });
  }
});

// GET /auth/login
router.get('/login', requireGuest, (req, res) => {
  res.render('auth/login', {
    title: 'Login',
    errors: [],
    formData: {}
  });
});

// POST /auth/login
router.post('/login', [
  requireGuest,
  body('email')
    .isEmail()
    .normalizeEmail()
    .withMessage('Please enter a valid email'),
  body('password')
    .notEmpty()
    .withMessage('Password is required')
], async (req, res) => {
  try {
    const errors = validationResult(req);

    if (!errors.isEmpty()) {
      return res.render('auth/login', {
        title: 'Login',
        errors: errors.array(),
        formData: req.body
      });
    }

    const { email, password } = req.body;

    // Find user
    const user = await User.findOne({ email });
    if (!user) {
      return res.render('auth/login', {
        title: 'Login',
        errors: [{ msg: 'Invalid email or password' }],
        formData: req.body
      });
    }

    // Check if user is banned
    if (user.isBanned) {
      return res.render('banned', {
        title: 'Account Suspended',
        message: 'Your account has been suspended. Please contact support.'
      });
    }

    // Check password
    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return res.render('auth/login', {
        title: 'Login',
        errors: [{ msg: 'Invalid email or password' }],
        formData: req.body
      });
    }

    // Create session
    req.session.user = {
      id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
      isBanned: user.isBanned
    };

    // Redirect to intended page or dashboard
    const redirectTo = req.session.returnTo || '/users/dashboard';
    delete req.session.returnTo;
    res.redirect(redirectTo);
  } catch (error) {
    console.error('Login error:', error);
    res.render('auth/login', {
      title: 'Login',
      errors: [{ msg: 'Login failed. Please try again.' }],
      formData: req.body
    });
  }
});

// POST /auth/logout
router.post('/logout', (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      console.error('Logout error:', err);
    }
    res.redirect('/');
  });
});

module.exports = router;
