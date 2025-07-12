const express = require('express');
const { body, validationResult } = require('express-validator');
const User = require('../models/User');
const SkillSwap = require('../models/SkillSwap');
const Feedback = require('../models/Feedback');
const Announcement = require('../models/Announcement');
const { requireAuth, requireAdmin, checkBanned } = require('../middleware/auth');

const router = express.Router();

// Apply auth, admin, and banned checks to all routes
router.use(requireAuth);
router.use(checkBanned);
router.use(requireAdmin);

// GET /admin - Admin dashboard
router.get('/', async (req, res) => {
  try {
    // Get system statistics
    const oneWeekAgo = new Date();
    oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);

    const stats = await Promise.all([
      User.countDocuments({ role: 'user' }),
      User.countDocuments({ isBanned: true }),
      SkillSwap.countDocuments(),
      SkillSwap.countDocuments({ status: 'pending' }),
      SkillSwap.countDocuments({ status: 'completed' }),
      Feedback.countDocuments(),
      Announcement.countDocuments({ isActive: true }),
      User.countDocuments({ role: 'user', createdAt: { $gte: oneWeekAgo } })
    ]);

    const [totalUsers, bannedUsers, totalSwaps, pendingSwaps, completedSwaps, totalFeedback, activeAnnouncements, newUsersThisWeek] = stats;

    // Get recent activity
    const recentUsers = await User.find({ role: 'user' })
      .select('name email createdAt isBanned')
      .sort({ createdAt: -1 })
      .limit(5);

    const recentSwaps = await SkillSwap.find()
      .populate('requester', 'name')
      .populate('recipient', 'name')
      .sort({ createdAt: -1 })
      .limit(5);

    const recentFeedback = await Feedback.find()
      .populate('reviewer', 'name')
      .populate('reviewee', 'name')
      .sort({ createdAt: -1 })
      .limit(5);

    res.render('admin/dashboard', {
      title: 'Admin Dashboard',
      user: req.session.user,
      stats: {
        totalUsers,
        bannedUsers,
        totalSwaps,
        pendingSwaps,
        completedSwaps,
        totalFeedback,
        activeAnnouncements,
        newUsersThisWeek
      },
      recentUsers,
      recentSwaps,
      recentFeedback
    });
  } catch (error) {
    console.error('Admin dashboard error:', error);
    res.render('admin/dashboard', {
      title: 'Admin Dashboard',
      user: req.session.user || { name: 'Admin', role: 'admin' },
      stats: {
        totalUsers: 0,
        bannedUsers: 0,
        totalSwaps: 0,
        pendingSwaps: 0,
        completedSwaps: 0,
        totalFeedback: 0,
        activeAnnouncements: 0,
        newUsersThisWeek: 0
      },
      recentUsers: [],
      recentSwaps: [],
      recentFeedback: []
    });
  }
});

// GET /admin/users - Manage users
router.get('/users', async (req, res) => {
  try {
    const { search, status = 'all', page = 1 } = req.query;
    const limit = 20;
    const skip = (page - 1) * limit;

    let query = { role: 'user' };

    // Search filter
    if (search && search.trim()) {
      query.$or = [
        { name: { $regex: search.trim(), $options: 'i' } },
        { email: { $regex: search.trim(), $options: 'i' } }
      ];
    }

    // Status filter
    if (status === 'banned') {
      query.isBanned = true;
    } else if (status === 'active') {
      query.isBanned = false;
    }

    const users = await User.find(query)
      .select('name email createdAt isBanned rating')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    const totalUsers = await User.countDocuments(query);
    const totalPages = Math.ceil(totalUsers / limit);

    res.render('admin/users', {
      title: 'Manage Users',
      users,
      filters: { search, status },
      pagination: {
        current: parseInt(page),
        total: totalPages,
        hasNext: page < totalPages,
        hasPrev: page > 1
      }
    });
  } catch (error) {
    console.error('Admin users error:', error);
    res.render('admin/users', {
      title: 'Manage Users',
      users: [],
      filters: { search: '', status: 'all' },
      pagination: { current: 1, total: 0, hasNext: false, hasPrev: false }
    });
  }
});

// POST /admin/users/:id/ban - Ban user
router.post('/users/:id/ban', async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    
    if (!user || user.role === 'admin') {
      return res.status(400).json({ error: 'Invalid user' });
    }

    user.isBanned = true;
    await user.save();

    res.json({ success: true, message: 'User banned successfully' });
  } catch (error) {
    console.error('Ban user error:', error);
    res.status(500).json({ error: 'Failed to ban user' });
  }
});

// POST /admin/users/:id/unban - Unban user
router.post('/users/:id/unban', async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    
    if (!user) {
      return res.status(400).json({ error: 'User not found' });
    }

    user.isBanned = false;
    await user.save();

    res.json({ success: true, message: 'User unbanned successfully' });
  } catch (error) {
    console.error('Unban user error:', error);
    res.status(500).json({ error: 'Failed to unban user' });
  }
});

// GET /admin/swaps - Manage swaps
router.get('/swaps', async (req, res) => {
  try {
    const { status = 'all', page = 1 } = req.query;
    const limit = 20;
    const skip = (page - 1) * limit;

    let query = {};

    // Status filter
    if (status !== 'all') {
      query.status = status;
    }

    const swaps = await SkillSwap.find(query)
      .populate('requester', 'name email')
      .populate('recipient', 'name email')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    const totalSwaps = await SkillSwap.countDocuments(query);
    const totalPages = Math.ceil(totalSwaps / limit);

    res.render('admin/swaps', {
      title: 'Manage Swaps',
      swaps,
      filters: { status },
      pagination: {
        current: parseInt(page),
        total: totalPages,
        hasNext: page < totalPages,
        hasPrev: page > 1
      }
    });
  } catch (error) {
    console.error('Admin swaps error:', error);
    res.render('admin/swaps', {
      title: 'Manage Swaps',
      swaps: [],
      filters: { status: 'all' },
      pagination: { current: 1, total: 0, hasNext: false, hasPrev: false }
    });
  }
});

// GET /admin/feedback - Manage feedback
router.get('/feedback', async (req, res) => {
  try {
    const { reported = 'all', page = 1 } = req.query;
    const limit = 20;
    const skip = (page - 1) * limit;

    let query = {};

    // Reported filter
    if (reported === 'yes') {
      query.isReported = true;
    } else if (reported === 'no') {
      query.isReported = false;
    }

    const feedback = await Feedback.find(query)
      .populate('reviewer', 'name email')
      .populate('reviewee', 'name email')
      .populate('skillSwap')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    const totalFeedback = await Feedback.countDocuments(query);
    const totalPages = Math.ceil(totalFeedback / limit);

    res.render('admin/feedback', {
      title: 'Manage Feedback',
      feedback,
      filters: { reported },
      pagination: {
        current: parseInt(page),
        total: totalPages,
        hasNext: page < totalPages,
        hasPrev: page > 1
      }
    });
  } catch (error) {
    console.error('Admin feedback error:', error);
    res.render('admin/feedback', {
      title: 'Manage Feedback',
      feedback: [],
      filters: { reported: 'all' },
      pagination: { current: 1, total: 0, hasNext: false, hasPrev: false }
    });
  }
});

// GET /admin/announcements - Manage announcements
router.get('/announcements', async (req, res) => {
  try {
    const { page = 1 } = req.query;
    const limit = 10;
    const skip = (page - 1) * limit;

    const announcements = await Announcement.find()
      .populate('createdBy', 'name')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    const totalAnnouncements = await Announcement.countDocuments();
    const totalPages = Math.ceil(totalAnnouncements / limit);

    res.render('admin/announcements', {
      title: 'Manage Announcements',
      announcements,
      pagination: {
        current: parseInt(page),
        total: totalPages,
        hasNext: page < totalPages,
        hasPrev: page > 1
      },
      errors: [],
      success: null
    });
  } catch (error) {
    console.error('Admin announcements error:', error);
    res.render('admin/announcements', {
      title: 'Manage Announcements',
      announcements: [],
      pagination: { current: 1, total: 0, hasNext: false, hasPrev: false },
      errors: [],
      success: null
    });
  }
});

// POST /admin/announcements - Create announcement
router.post('/announcements', [
  body('title')
    .trim()
    .isLength({ min: 1, max: 100 })
    .withMessage('Title must be between 1 and 100 characters'),
  body('message')
    .trim()
    .isLength({ min: 1, max: 1000 })
    .withMessage('Message must be between 1 and 1000 characters'),
  body('type')
    .isIn(['info', 'warning', 'success', 'error'])
    .withMessage('Invalid announcement type'),
  body('targetAudience')
    .isIn(['all', 'users', 'admins'])
    .withMessage('Invalid target audience'),
  body('expiresAt')
    .optional()
    .isISO8601()
    .withMessage('Invalid expiration date')
], async (req, res) => {
  try {
    const errors = validationResult(req);

    if (!errors.isEmpty()) {
      const announcements = await Announcement.find()
        .populate('createdBy', 'name')
        .sort({ createdAt: -1 })
        .limit(10);

      return res.render('admin/announcements', {
        title: 'Manage Announcements',
        announcements,
        pagination: { current: 1, total: 1, hasNext: false, hasPrev: false },
        errors: errors.array(),
        success: null
      });
    }

    const { title, message, type, targetAudience, expiresAt } = req.body;

    const announcement = new Announcement({
      title,
      message,
      type,
      targetAudience,
      createdBy: req.session.user.id,
      expiresAt: expiresAt ? new Date(expiresAt) : null
    });

    await announcement.save();

    res.redirect('/admin/announcements?success=created');
  } catch (error) {
    console.error('Create announcement error:', error);
    const announcements = await Announcement.find()
      .populate('createdBy', 'name')
      .sort({ createdAt: -1 })
      .limit(10);

    res.render('admin/announcements', {
      title: 'Manage Announcements',
      announcements,
      pagination: { current: 1, total: 1, hasNext: false, hasPrev: false },
      errors: [{ msg: 'Failed to create announcement' }],
      success: null
    });
  }
});

// POST /admin/announcements/:id/toggle - Toggle announcement active status
router.post('/announcements/:id/toggle', async (req, res) => {
  try {
    const announcement = await Announcement.findById(req.params.id);

    if (!announcement) {
      return res.status(404).json({ error: 'Announcement not found' });
    }

    announcement.isActive = !announcement.isActive;
    await announcement.save();

    res.json({
      success: true,
      message: `Announcement ${announcement.isActive ? 'activated' : 'deactivated'}`,
      isActive: announcement.isActive
    });
  } catch (error) {
    console.error('Toggle announcement error:', error);
    res.status(500).json({ error: 'Failed to toggle announcement' });
  }
});

// DELETE /admin/announcements/:id - Delete announcement
router.delete('/announcements/:id', async (req, res) => {
  try {
    await Announcement.findByIdAndDelete(req.params.id);
    res.json({ success: true, message: 'Announcement deleted successfully' });
  } catch (error) {
    console.error('Delete announcement error:', error);
    res.status(500).json({ error: 'Failed to delete announcement' });
  }
});

// GET /admin/reports - Generate reports
router.get('/reports', async (req, res) => {
  try {
    const { type = 'users', format = 'view' } = req.query;

    let data = [];
    let title = 'System Reports';

    switch (type) {
      case 'users':
        data = await User.find({ role: 'user' })
          .select('name email createdAt isBanned rating')
          .sort({ createdAt: -1 });
        title = 'Users Report';
        break;

      case 'swaps':
        data = await SkillSwap.find()
          .populate('requester', 'name email')
          .populate('recipient', 'name email')
          .sort({ createdAt: -1 });
        title = 'Swaps Report';
        break;

      case 'feedback':
        data = await Feedback.find()
          .populate('reviewer', 'name email')
          .populate('reviewee', 'name email')
          .sort({ createdAt: -1 });
        title = 'Feedback Report';
        break;
    }

    if (format === 'json') {
      res.json(data);
    } else {
      res.render('admin/reports', {
        title,
        data,
        reportType: type
      });
    }
  } catch (error) {
    console.error('Reports error:', error);
    res.render('admin/reports', {
      title: 'System Reports',
      data: [],
      reportType: 'users'
    });
  }
});

module.exports = router;
