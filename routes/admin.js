const express = require('express');
const { body, validationResult } = require('express-validator');
const User = require('../models/User');
const SkillSwap = require('../models/SkillSwap');
const Feedback = require('../models/Feedback');
const Announcement = require('../models/Announcement');
const Contact = require('../models/Contact');
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
      Contact.countDocuments(),
      Contact.countDocuments({ status: 'new' }),
      User.countDocuments({ role: 'user', createdAt: { $gte: oneWeekAgo } })
    ]);

    const [totalUsers, bannedUsers, totalSwaps, pendingSwaps, completedSwaps, totalFeedback, activeAnnouncements, totalContacts, pendingContacts, newUsersThisWeek] = stats;

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
        totalContacts,
        pendingContacts,
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
    const { search, status = 'all', role = 'all', page = 1 } = req.query;
    const limit = 20;
    const skip = (page - 1) * limit;

    let query = {};

    // Role filter
    if (role !== 'all') {
      query.role = role;
    }

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
      title: 'User Management',
      user: req.session.user,
      users,
      filters: { search, status, role },
      success: req.query.success,
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

// GET /admin/users/create - Create new user form
router.get('/users/create', (req, res) => {
  res.render('admin/user-form', {
    title: 'Create New User',
    user: req.session.user,
    editUser: null,
    isEdit: false
  });
});

// POST /admin/users/create - Create new user
router.post('/users/create', [
  body('name')
    .trim()
    .isLength({ min: 2, max: 50 })
    .withMessage('Name must be between 2 and 50 characters'),
  body('email')
    .isEmail()
    .normalizeEmail()
    .withMessage('Please enter a valid email address'),
  body('password')
    .isLength({ min: 6 })
    .withMessage('Password must be at least 6 characters long'),
  body('role')
    .isIn(['user', 'admin'])
    .withMessage('Role must be either user or admin')
], async (req, res) => {
  try {
    const errors = validationResult(req);

    if (!errors.isEmpty()) {
      return res.render('admin/user-form', {
        title: 'Create New User',
        user: req.session.user,
        editUser: null,
        isEdit: false,
        errors: errors.array(),
        formData: req.body
      });
    }

    const { name, email, password, role } = req.body;

    // Check if user already exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.render('admin/user-form', {
        title: 'Create New User',
        user: req.session.user,
        editUser: null,
        isEdit: false,
        errors: [{ msg: 'User with this email already exists' }],
        formData: req.body
      });
    }

    // Create new user
    const newUser = new User({
      name,
      email,
      password, // Will be hashed by the pre-save middleware
      role,
      isPublic: true
    });

    await newUser.save();

    res.redirect('/admin/users?success=User created successfully');
  } catch (error) {
    console.error('Create user error:', error);
    res.render('admin/user-form', {
      title: 'Create New User',
      user: req.session.user,
      editUser: null,
      isEdit: false,
      errors: [{ msg: 'Failed to create user. Please try again.' }],
      formData: req.body
    });
  }
});

// GET /admin/users/:id/edit - Edit user form
router.get('/users/:id/edit', async (req, res) => {
  try {
    const editUser = await User.findById(req.params.id);

    if (!editUser) {
      return res.status(404).render('404', { title: 'User Not Found' });
    }

    res.render('admin/user-form', {
      title: 'Edit User',
      user: req.session.user,
      editUser,
      isEdit: true
    });
  } catch (error) {
    console.error('Edit user form error:', error);
    res.status(404).render('404', { title: 'User Not Found' });
  }
});

// POST /admin/users/:id/edit - Update user
router.post('/users/:id/edit', [
  body('name')
    .trim()
    .isLength({ min: 2, max: 50 })
    .withMessage('Name must be between 2 and 50 characters'),
  body('email')
    .isEmail()
    .normalizeEmail()
    .withMessage('Please enter a valid email address'),
  body('password')
    .optional()
    .isLength({ min: 6 })
    .withMessage('Password must be at least 6 characters long'),
  body('role')
    .isIn(['user', 'admin'])
    .withMessage('Role must be either user or admin')
], async (req, res) => {
  try {
    const editUser = await User.findById(req.params.id);

    if (!editUser) {
      return res.status(404).render('404', { title: 'User Not Found' });
    }

    const errors = validationResult(req);

    if (!errors.isEmpty()) {
      return res.render('admin/user-form', {
        title: 'Edit User',
        user: req.session.user,
        editUser,
        isEdit: true,
        errors: errors.array(),
        formData: req.body
      });
    }

    const { name, email, password, role } = req.body;

    // Check if email is already taken by another user
    const existingUser = await User.findOne({
      email,
      _id: { $ne: req.params.id }
    });

    if (existingUser) {
      return res.render('admin/user-form', {
        title: 'Edit User',
        user: req.session.user,
        editUser,
        isEdit: true,
        errors: [{ msg: 'Email is already taken by another user' }],
        formData: req.body
      });
    }

    // Update user fields
    editUser.name = name;
    editUser.email = email;
    editUser.role = role;

    // Only update password if provided
    if (password && password.trim()) {
      editUser.password = password; // Will be hashed by pre-save middleware
    }

    await editUser.save();

    res.redirect('/admin/users?success=User updated successfully');
  } catch (error) {
    console.error('Update user error:', error);
    const editUser = await User.findById(req.params.id);
    res.render('admin/user-form', {
      title: 'Edit User',
      user: req.session.user,
      editUser,
      isEdit: true,
      errors: [{ msg: 'Failed to update user. Please try again.' }],
      formData: req.body
    });
  }
});

// POST /admin/users/:id/reset-password - Reset user password
router.post('/users/:id/reset-password', async (req, res) => {
  try {
    const { password } = req.body;

    if (!password || password.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters long' });
    }

    const user = await User.findById(req.params.id);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    user.password = password; // Will be hashed by pre-save middleware
    await user.save();

    res.json({ success: true, message: 'Password reset successfully' });
  } catch (error) {
    console.error('Reset password error:', error);
    res.status(500).json({ error: 'Failed to reset password' });
  }
});

// DELETE /admin/users/:id - Delete user
router.delete('/users/:id', async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Don't allow deleting the current admin user
    if (user._id.toString() === req.session.user.id) {
      return res.status(400).json({ error: 'Cannot delete your own account' });
    }

    // Delete user and related data
    await User.findByIdAndDelete(req.params.id);

    // Also delete related swaps and feedback
    const SkillSwap = require('../models/SkillSwap');
    const Feedback = require('../models/Feedback');

    await SkillSwap.deleteMany({
      $or: [
        { requester: req.params.id },
        { recipient: req.params.id }
      ]
    });

    await Feedback.deleteMany({
      $or: [
        { reviewer: req.params.id },
        { reviewee: req.params.id }
      ]
    });

    res.json({ success: true, message: 'User deleted successfully' });
  } catch (error) {
    console.error('Delete user error:', error);
    res.status(500).json({ error: 'Failed to delete user' });
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

    // Debug: Check swap IDs
    console.log('Admin swaps - First swap ID:', swaps.length > 0 ? swaps[0]._id : 'No swaps');
    console.log('Admin swaps - First swap ID type:', swaps.length > 0 ? typeof swaps[0]._id : 'N/A');

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

// GET /admin/contacts - Manage contact submissions
router.get('/contacts', async (req, res) => {
  try {
    const { status = 'all', priority = 'all', subject = 'all', page = 1 } = req.query;
    const limit = 20;
    const skip = (page - 1) * limit;

    let query = {};

    // Status filter
    if (status !== 'all') {
      query.status = status;
    }

    // Priority filter
    if (priority !== 'all') {
      query.priority = priority;
    }

    // Subject filter
    if (subject !== 'all') {
      query.subject = subject;
    }

    const contacts = await Contact.find(query)
      .populate('assignedTo', 'name email')
      .populate('resolvedBy', 'name email')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    const totalContacts = await Contact.countDocuments(query);
    const totalPages = Math.ceil(totalContacts / limit);

    // Get statistics
    const stats = await Contact.getStats();

    res.render('admin/contacts', {
      title: 'Contact Management',
      user: req.session.user,
      contacts,
      stats,
      filters: { status, priority, subject },
      success: req.query.success,
      pagination: {
        current: parseInt(page),
        total: totalPages,
        hasNext: page < totalPages,
        hasPrev: page > 1
      }
    });
  } catch (error) {
    console.error('Admin contacts error:', error);
    res.render('admin/contacts', {
      title: 'Contact Management',
      user: req.session.user,
      contacts: [],
      stats: { total: 0, new: 0, inProgress: 0, resolved: 0, closed: 0 },
      filters: { status: 'all', priority: 'all', subject: 'all' },
      pagination: { current: 1, total: 1, hasNext: false, hasPrev: false }
    });
  }
});

// GET /admin/contacts/:id - View contact details
router.get('/contacts/:id', async (req, res) => {
  try {
    const contact = await Contact.findById(req.params.id)
      .populate('assignedTo', 'name email')
      .populate('resolvedBy', 'name email');

    if (!contact) {
      return res.status(404).render('404', { title: 'Contact Not Found' });
    }

    // Mark as read if not already
    if (!contact.isRead) {
      await contact.markAsRead();
    }

    res.render('admin/contact-details', {
      title: 'Contact Details',
      user: req.session.user,
      contact,
      success: req.query.success
    });
  } catch (error) {
    console.error('Contact details error:', error);
    res.status(404).render('404', { title: 'Contact Not Found' });
  }
});

// POST /admin/contacts/:id/update - Update contact status/priority
router.post('/contacts/:id/update', [
  body('status')
    .isIn(['new', 'in-progress', 'resolved', 'closed'])
    .withMessage('Invalid status'),
  body('priority')
    .isIn(['low', 'medium', 'high', 'urgent'])
    .withMessage('Invalid priority'),
  body('adminNotes')
    .optional()
    .trim()
    .isLength({ max: 1000 })
    .withMessage('Admin notes must be less than 1000 characters')
], async (req, res) => {
  try {
    const errors = validationResult(req);

    if (!errors.isEmpty()) {
      return res.redirect(`/admin/contacts/${req.params.id}?error=Invalid input data`);
    }

    const contact = await Contact.findById(req.params.id);
    if (!contact) {
      return res.status(404).json({ error: 'Contact not found' });
    }

    const { status, priority, adminNotes } = req.body;

    contact.status = status;
    contact.priority = priority;
    contact.adminNotes = adminNotes || '';

    if (status === 'resolved' || status === 'closed') {
      contact.resolvedAt = new Date();
      contact.resolvedBy = req.session.user.id;
    }

    await contact.save();

    res.redirect(`/admin/contacts/${req.params.id}?success=Contact updated successfully`);
  } catch (error) {
    console.error('Update contact error:', error);
    res.redirect(`/admin/contacts/${req.params.id}?error=Failed to update contact`);
  }
});

// POST /admin/contacts/:id/assign - Assign contact to admin
router.post('/contacts/:id/assign', async (req, res) => {
  try {
    const contact = await Contact.findById(req.params.id);
    if (!contact) {
      return res.status(404).json({ error: 'Contact not found' });
    }

    contact.assignedTo = req.session.user.id;
    if (contact.status === 'new') {
      contact.status = 'in-progress';
    }

    await contact.save();

    res.json({ success: true, message: 'Contact assigned successfully' });
  } catch (error) {
    console.error('Assign contact error:', error);
    res.status(500).json({ error: 'Failed to assign contact' });
  }
});

// DELETE /admin/contacts/:id - Delete contact
router.delete('/contacts/:id', async (req, res) => {
  try {
    const contact = await Contact.findByIdAndDelete(req.params.id);
    if (!contact) {
      return res.status(404).json({ error: 'Contact not found' });
    }

    res.json({ success: true, message: 'Contact deleted successfully' });
  } catch (error) {
    console.error('Delete contact error:', error);
    res.status(500).json({ error: 'Failed to delete contact' });
  }
});

module.exports = router;
