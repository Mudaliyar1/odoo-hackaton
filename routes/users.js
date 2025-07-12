const express = require('express');
const mongoose = require('mongoose');
const { body, validationResult } = require('express-validator');
const User = require('../models/User');
const SkillSwap = require('../models/SkillSwap');
const Feedback = require('../models/Feedback');
const Announcement = require('../models/Announcement');
const { requireAuth, checkBanned } = require('../middleware/auth');
const { upload, handleUploadError } = require('../middleware/upload');
const path = require('path');
const fs = require('fs');

const router = express.Router();

// Apply auth and banned checks to all routes
router.use(requireAuth);
router.use(checkBanned);

// GET /users/dashboard
router.get('/dashboard', async (req, res) => {
  try {
    const userId = req.session.user.id;

    // Get fresh user data from database
    const user = await User.findById(userId);
    if (!user) {
      return res.redirect('/auth/login');
    }

    // Get user's swap statistics
    const swapStats = await SkillSwap.getUserStats(userId);

    // Get recent incoming requests
    const incomingRequests = await SkillSwap.find({
      recipient: userId,
      status: 'pending'
    })
    .populate('requester', 'name profilePhoto')
    .sort({ createdAt: -1 })
    .limit(5);

    // Get recent outgoing requests
    const outgoingRequests = await SkillSwap.find({
      requester: userId,
      status: 'pending'
    })
    .populate('recipient', 'name profilePhoto')
    .sort({ createdAt: -1 })
    .limit(5);

    // Get active announcements
    const announcements = await Announcement.getActiveAnnouncements(user.role);

    res.render('users/dashboard', {
      title: 'Dashboard',
      user: user,
      swapStats,
      incomingRequests,
      outgoingRequests,
      announcements
    });
  } catch (error) {
    console.error('Dashboard error:', error);
    res.render('users/dashboard', {
      title: 'Dashboard',
      user: req.session.user,
      swapStats: { pending: 0, accepted: 0, completed: 0, rejected: 0, cancelled: 0, total: 0 },
      incomingRequests: [],
      outgoingRequests: [],
      announcements: []
    });
  }
});

// GET /users/profile
router.get('/profile', async (req, res) => {
  try {
    const user = await User.findById(req.session.user.id);
    const feedbackStats = await Feedback.getUserFeedbackStats(req.session.user.id);
    
    res.render('users/profile', {
      title: 'My Profile',
      profile: user,
      feedbackStats,
      errors: [],
      success: null
    });
  } catch (error) {
    console.error('Profile error:', error);
    res.redirect('/users/dashboard');
  }
});

// POST /users/profile
router.post('/profile', [
  upload.single('profilePhoto'),
  handleUploadError,
  body('name')
    .trim()
    .isLength({ min: 2, max: 100 })
    .withMessage('Name must be between 2 and 100 characters'),
  body('location')
    .optional()
    .trim()
    .isLength({ max: 100 })
    .withMessage('Location must be less than 100 characters'),
  body('bio')
    .optional()
    .trim()
    .isLength({ max: 500 })
    .withMessage('Bio must be less than 500 characters'),
  body('skillsOffered')
    .optional()
    .custom((value) => {
      if (value && value.length > 20) {
        throw new Error('Maximum 20 skills allowed');
      }
      return true;
    }),
  body('skillsWanted')
    .optional()
    .custom((value) => {
      if (value && value.length > 20) {
        throw new Error('Maximum 20 skills allowed');
      }
      return true;
    })
], async (req, res) => {
  try {
    const errors = validationResult(req);
    const user = await User.findById(req.session.user.id);
    
    // Add upload error if exists
    if (req.uploadError) {
      errors.errors.push({ msg: req.uploadError });
    }
    
    if (!errors.isEmpty()) {
      const feedbackStats = await Feedback.getUserFeedbackStats(req.session.user.id);
      return res.render('users/profile', {
        title: 'My Profile',
        profile: user,
        feedbackStats,
        errors: errors.array(),
        success: null
      });
    }

    const {
      name,
      location,
      bio,
      skillsOffered,
      skillsWanted,
      isPublic,
      'availability.weekdays': weekdays,
      'availability.weekends': weekends,
      'availability.evenings': evenings
    } = req.body;

    // Update user data
    user.name = name;
    user.location = location || '';
    user.bio = bio || '';
    user.isPublic = isPublic === 'on';
    user.availability = {
      weekdays: weekdays === 'on',
      weekends: weekends === 'on',
      evenings: evenings === 'on'
    };

    // Process skills arrays
    if (skillsOffered) {
      user.skillsOffered = Array.isArray(skillsOffered) 
        ? skillsOffered.filter(skill => skill.trim())
        : [skillsOffered].filter(skill => skill.trim());
    }

    if (skillsWanted) {
      user.skillsWanted = Array.isArray(skillsWanted)
        ? skillsWanted.filter(skill => skill.trim())
        : [skillsWanted].filter(skill => skill.trim());
    }

    // Handle profile photo upload
    if (req.file) {
      // Delete old profile photo if exists
      if (user.profilePhoto) {
        const oldPhotoPath = path.join(__dirname, '../public/uploads', user.profilePhoto);
        if (fs.existsSync(oldPhotoPath)) {
          fs.unlinkSync(oldPhotoPath);
        }
      }
      user.profilePhoto = req.file.filename;
    }

    await user.save();

    // Update session
    req.session.user.name = user.name;

    const feedbackStats = await Feedback.getUserFeedbackStats(req.session.user.id);
    res.render('users/profile', {
      title: 'My Profile',
      profile: user,
      feedbackStats,
      errors: [],
      success: 'Profile updated successfully!'
    });
  } catch (error) {
    console.error('Profile update error:', error);
    const user = await User.findById(req.session.user.id);
    const feedbackStats = await Feedback.getUserFeedbackStats(req.session.user.id);
    res.render('users/profile', {
      title: 'My Profile',
      profile: user,
      feedbackStats,
      errors: [{ msg: 'Profile update failed. Please try again.' }],
      success: null
    });
  }
});

// GET /users/skills - Manage skills page
router.get('/skills', async (req, res) => {
  try {
    // Fetch fresh user data from database
    const user = await User.findById(req.session.user.id);
    if (!user) {
      return res.redirect('/auth/login');
    }

    res.render('users/skills', {
      title: 'Manage Skills',
      user: user,
      errors: null,
      success: null
    });
  } catch (error) {
    console.error('Skills page error:', error);
    res.redirect('/users/dashboard');
  }
});

// POST /users/skills - Update skills
router.post('/skills', [
  body('skillsOffered.*').trim().isLength({ min: 1, max: 50 }).withMessage('Each skill must be 1-50 characters'),
  body('skillsWanted.*').trim().isLength({ min: 1, max: 50 }).withMessage('Each skill must be 1-50 characters')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.render('users/skills', {
        title: 'Manage Skills',
        user: req.session.user,
        errors: errors.array(),
        success: null
      });
    }

    const { skillsOffered, skillsWanted } = req.body;

    // Filter out empty skills and remove duplicates
    const cleanSkillsOffered = [...new Set(
      (Array.isArray(skillsOffered) ? skillsOffered : [skillsOffered])
        .filter(skill => skill && skill.trim())
        .map(skill => skill.trim())
    )];

    const cleanSkillsWanted = [...new Set(
      (Array.isArray(skillsWanted) ? skillsWanted : [skillsWanted])
        .filter(skill => skill && skill.trim())
        .map(skill => skill.trim())
    )];

    // Update user skills
    await User.findByIdAndUpdate(req.session.user.id, {
      skillsOffered: cleanSkillsOffered,
      skillsWanted: cleanSkillsWanted
    });

    // Update session
    req.session.user.skillsOffered = cleanSkillsOffered;
    req.session.user.skillsWanted = cleanSkillsWanted;

    res.render('users/skills', {
      title: 'Manage Skills',
      user: req.session.user,
      errors: null,
      success: 'Skills updated successfully!'
    });
  } catch (error) {
    console.error('Skills update error:', error);
    res.render('users/skills', {
      title: 'Manage Skills',
      user: req.session.user,
      errors: [{ msg: 'Failed to update skills. Please try again.' }],
      success: null
    });
  }
});

// GET /users/search - Search users
router.get('/search', async (req, res) => {
  try {
    const { q, skill, availability, page = 1 } = req.query;
    const limit = 12;
    const skip = (page - 1) * limit;

    // Build search query
    let query = {
      isPublic: true,
      isBanned: false,
      _id: { $ne: req.session.user.id } // Exclude current user
    };

    if (q) {
      query.$or = [
        { name: { $regex: q, $options: 'i' } },
        { bio: { $regex: q, $options: 'i' } },
        { location: { $regex: q, $options: 'i' } },
        { skillsOffered: { $in: [new RegExp(q, 'i')] } },
        { skillsWanted: { $in: [new RegExp(q, 'i')] } }
      ];
    }

    if (skill) {
      query.skillsOffered = { $in: [new RegExp(skill, 'i')] };
    }

    if (availability && Array.isArray(availability)) {
      const availabilityQuery = {};
      availability.forEach(avail => {
        availabilityQuery[`availability.${avail}`] = true;
      });
      query = { ...query, ...availabilityQuery };
    }

    const users = await User.find(query)
      .select('name location bio skillsOffered skillsWanted availability profilePhoto rating')
      .limit(limit)
      .skip(skip)
      .sort({ createdAt: -1 });

    const totalUsers = await User.countDocuments(query);
    const totalPages = Math.ceil(totalUsers / limit);

    res.render('users/search', {
      title: 'Search Users',
      users,
      query: req.query,
      pagination: {
        current: parseInt(page),
        total: totalPages,
        hasNext: page < totalPages,
        hasPrev: page > 1
      }
    });
  } catch (error) {
    console.error('Search error:', error);
    res.render('users/search', {
      title: 'Search Users',
      users: [],
      query: req.query,
      pagination: { current: 1, total: 0, hasNext: false, hasPrev: false }
    });
  }
});

// GET /users/:id - View public profile
router.get('/:id', async (req, res) => {
  try {
    const userId = req.params.id;

    // Validate ObjectId format
    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(404).render('404', { title: 'User Not Found' });
    }

    const user = await User.findById(userId);

    if (!user || !user.isPublic || user.isBanned) {
      return res.status(404).render('404', { title: 'User Not Found' });
    }

    // Get user's feedback
    const feedback = await Feedback.find({
      reviewee: user._id,
      isPublic: true
    })
    .populate('reviewer', 'name')
    .sort({ createdAt: -1 })
    .limit(10);

    const feedbackStats = await Feedback.getUserFeedbackStats(user._id);

    res.render('users/view-profile', {
      title: user.name + "'s Profile",
      profile: user,
      feedback,
      feedbackStats,
      canSendRequest: req.session.user.id !== user._id.toString()
    });
  } catch (error) {
    console.error('View profile error:', error);
    res.status(404).render('404', { title: 'User Not Found' });
  }
});

// DELETE /users/account - Delete account
router.delete('/account', async (req, res) => {
  try {
    const userId = req.session.user.id;

    // Delete user's profile photo
    const user = await User.findById(userId);
    if (user && user.profilePhoto) {
      const photoPath = path.join(__dirname, '../public/uploads', user.profilePhoto);
      if (fs.existsSync(photoPath)) {
        fs.unlinkSync(photoPath);
      }
    }

    // Delete user and related data
    await Promise.all([
      User.findByIdAndDelete(userId),
      SkillSwap.deleteMany({ $or: [{ requester: userId }, { recipient: userId }] }),
      Feedback.deleteMany({ $or: [{ reviewer: userId }, { reviewee: userId }] })
    ]);

    // Destroy session
    req.session.destroy((err) => {
      if (err) {
        console.error('Session destruction error:', err);
      }
      res.redirect('/');
    });
  } catch (error) {
    console.error('Account deletion error:', error);
    res.status(500).json({ error: 'Account deletion failed' });
  }
});

module.exports = router;
