const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const Contact = require('../models/Contact');

// GET /help - Help Center
router.get('/help', (req, res) => {
  res.render('pages/help', {
    title: 'Help Center',
    user: req.session.user || null
  });
});

// GET /contact - Contact Us
router.get('/contact', (req, res) => {
  res.render('pages/contact', {
    title: 'Contact Us',
    user: req.session.user || null,
    success: req.query.success
  });
});

// POST /contact - Submit contact form
router.post('/contact', [
  body('name')
    .trim()
    .isLength({ min: 2, max: 100 })
    .withMessage('Name must be between 2 and 100 characters'),
  body('email')
    .isEmail()
    .normalizeEmail()
    .withMessage('Please enter a valid email address'),
  body('subject')
    .isIn(['technical', 'account', 'swap', 'feedback', 'other'])
    .withMessage('Please select a valid subject'),
  body('message')
    .trim()
    .isLength({ min: 10, max: 2000 })
    .withMessage('Message must be between 10 and 2000 characters')
], async (req, res) => {
  try {
    const errors = validationResult(req);

    if (!errors.isEmpty()) {
      return res.render('pages/contact', {
        title: 'Contact Us',
        user: req.session.user || null,
        errors: errors.array(),
        formData: req.body
      });
    }

    const { name, email, subject, message } = req.body;

    // Create new contact submission
    const contact = new Contact({
      name,
      email,
      subject,
      message,
      userAgent: req.get('User-Agent') || '',
      ipAddress: req.ip || req.connection.remoteAddress || ''
    });

    await contact.save();

    // Redirect with success message
    res.redirect('/contact?success=Thank you for your message! We will get back to you within 24 hours.');
  } catch (error) {
    console.error('Contact form error:', error);
    res.render('pages/contact', {
      title: 'Contact Us',
      user: req.session.user || null,
      errors: [{ msg: 'Failed to send message. Please try again.' }],
      formData: req.body
    });
  }
});

// GET /privacy - Privacy Policy
router.get('/privacy', (req, res) => {
  res.render('pages/privacy', {
    title: 'Privacy Policy',
    user: req.session.user || null
  });
});

// GET /terms - Terms of Service
router.get('/terms', (req, res) => {
  res.render('pages/terms', {
    title: 'Terms of Service',
    user: req.session.user || null
  });
});

// GET /about - About Us
router.get('/about', (req, res) => {
  res.render('pages/about', {
    title: 'About Us',
    user: req.session.user || null
  });
});

module.exports = router;
