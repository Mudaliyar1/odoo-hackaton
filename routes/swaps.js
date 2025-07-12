const express = require('express');
const { body, validationResult } = require('express-validator');
const SkillSwap = require('../models/SkillSwap');
const User = require('../models/User');
const Feedback = require('../models/Feedback');
const { requireAuth, checkBanned } = require('../middleware/auth');

const router = express.Router();

// Apply auth and banned checks to all routes
router.use(requireAuth);
router.use(checkBanned);

// GET /swaps - List all user's swaps
router.get('/', async (req, res) => {
  try {
    const userId = req.session.user.id;
    const { status = 'all', type = 'all', page = 1 } = req.query;
    const limit = 10;
    const skip = (page - 1) * limit;

    let query = {
      $or: [
        { requester: userId },
        { recipient: userId }
      ]
    };

    // Filter by status
    if (status !== 'all') {
      query.status = status;
    }

    // Filter by type (incoming/outgoing)
    if (type === 'incoming') {
      query = { recipient: userId };
      if (status !== 'all') query.status = status;
    } else if (type === 'outgoing') {
      query = { requester: userId };
      if (status !== 'all') query.status = status;
    }

    const swaps = await SkillSwap.find(query)
      .populate('requester', 'name profilePhoto')
      .populate('recipient', 'name profilePhoto')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    const totalSwaps = await SkillSwap.countDocuments(query);
    const totalPages = Math.ceil(totalSwaps / limit);

    res.render('swaps/list', {
      title: 'My Skill Swaps',
      swaps,
      currentUserId: userId,
      filters: { status, type },
      pagination: {
        current: parseInt(page),
        total: totalPages,
        hasNext: page < totalPages,
        hasPrev: page > 1
      }
    });
  } catch (error) {
    console.error('Swaps list error:', error);
    res.render('swaps/list', {
      title: 'My Skill Swaps',
      swaps: [],
      currentUserId: req.session.user.id,
      filters: { status: 'all', type: 'all' },
      pagination: {
        current: 1,
        total: 1,
        hasNext: false,
        hasPrev: false
      }
    });
  }
});

// GET /swaps/create/:userId - Create swap request form
router.get('/create/:userId', async (req, res) => {
  try {
    const recipient = await User.findById(req.params.userId);
    
    if (!recipient || !recipient.isPublic || recipient.isBanned) {
      return res.status(404).render('404', { title: 'User Not Found' });
    }

    if (recipient._id.toString() === req.session.user.id) {
      return res.redirect('/users/dashboard');
    }

    const requester = await User.findById(req.session.user.id);

    res.render('swaps/create', {
      title: 'Create Skill Swap Request',
      recipient,
      requester,
      errors: [],
      formData: {}
    });
  } catch (error) {
    console.error('Create swap form error:', error);
    res.status(404).render('404', { title: 'User Not Found' });
  }
});

// POST /swaps/create/:userId - Submit swap request
router.post('/create/:userId', [
  body('skillsOffered')
    .isArray({ min: 1 })
    .withMessage('Please select at least one skill you offer'),
  body('skillsWanted')
    .isArray({ min: 1 })
    .withMessage('Please select at least one skill you want'),
  body('message')
    .optional()
    .trim()
    .isLength({ max: 500 })
    .withMessage('Message must be less than 500 characters')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    const recipient = await User.findById(req.params.userId);
    
    if (!recipient || !recipient.isPublic || recipient.isBanned) {
      return res.status(404).render('404', { title: 'User Not Found' });
    }

    if (recipient._id.toString() === req.session.user.id) {
      return res.redirect('/users/dashboard');
    }

    if (!errors.isEmpty()) {
      const requester = await User.findById(req.session.user.id);
      return res.render('swaps/create', {
        title: 'Create Skill Swap Request',
        recipient,
        requester,
        errors: errors.array(),
        formData: req.body
      });
    }

    // Check for existing pending request
    const existingRequest = await SkillSwap.findOne({
      requester: req.session.user.id,
      recipient: req.params.userId,
      status: 'pending'
    });

    if (existingRequest) {
      const requester = await User.findById(req.session.user.id);
      return res.render('swaps/create', {
        title: 'Create Skill Swap Request',
        recipient,
        requester,
        errors: [{ msg: 'You already have a pending request with this user' }],
        formData: req.body
      });
    }

    const { skillsOffered, skillsWanted, message } = req.body;

    const skillSwap = new SkillSwap({
      requester: req.session.user.id,
      recipient: req.params.userId,
      skillsOffered,
      skillsWanted,
      message: message || ''
    });

    await skillSwap.save();

    res.redirect('/swaps?status=pending&type=outgoing');
  } catch (error) {
    console.error('Create swap error:', error);
    const recipient = await User.findById(req.params.userId);
    const requester = await User.findById(req.session.user.id);
    res.render('swaps/create', {
      title: 'Create Skill Swap Request',
      recipient,
      requester,
      errors: [{ msg: 'Failed to create swap request. Please try again.' }],
      formData: req.body
    });
  }
});

// GET /swaps/:id - View swap details
router.get('/:id', async (req, res) => {
  try {
    const swap = await SkillSwap.findById(req.params.id)
      .populate('requester', 'name profilePhoto email')
      .populate('recipient', 'name profilePhoto email');

    if (!swap) {
      return res.status(404).render('404', { title: 'Swap Not Found' });
    }

    // Check if user is part of this swap
    const userId = req.session.user.id;
    const isParticipant = swap.requester._id.toString() === userId || 
                         swap.recipient._id.toString() === userId;

    if (!isParticipant) {
      return res.status(403).render('error', {
        title: 'Access Denied',
        error: { message: 'You are not authorized to view this swap' }
      });
    }

    // Get feedback if swap is completed
    let feedback = null;
    if (swap.status === 'completed') {
      feedback = await Feedback.find({ skillSwap: swap._id })
        .populate('reviewer', 'name')
        .populate('reviewee', 'name');
    }

    // Check if current user can leave feedback
    let canLeaveFeedback = false;
    if (swap.status === 'completed') {
      const feedbackCheck = await Feedback.canLeaveFeedback(swap._id, userId);
      canLeaveFeedback = feedbackCheck.canLeave;
    }

    res.render('swaps/details', {
      title: 'Swap Details',
      swap,
      currentUserId: userId,
      feedback,
      canLeaveFeedback
    });
  } catch (error) {
    console.error('Swap details error:', error);
    res.status(404).render('404', { title: 'Swap Not Found' });
  }
});

// POST /swaps/:id/accept - Accept swap request
router.post('/:id/accept', async (req, res) => {
  try {
    const swap = await SkillSwap.findById(req.params.id);

    if (!swap || swap.recipient.toString() !== req.session.user.id || swap.status !== 'pending') {
      return res.status(400).json({ error: 'Invalid request' });
    }

    await swap.updateStatus('accepted');
    res.redirect(`/swaps/${swap._id}`);
  } catch (error) {
    console.error('Accept swap error:', error);
    res.status(500).json({ error: 'Failed to accept swap' });
  }
});

// POST /swaps/:id/reject - Reject swap request
router.post('/:id/reject', [
  body('reason')
    .optional()
    .trim()
    .isLength({ max: 200 })
    .withMessage('Reason must be less than 200 characters')
], async (req, res) => {
  try {
    const swap = await SkillSwap.findById(req.params.id);

    if (!swap || swap.recipient.toString() !== req.session.user.id || swap.status !== 'pending') {
      return res.status(400).json({ error: 'Invalid request' });
    }

    await swap.updateStatus('rejected', req.body.reason);
    res.redirect(`/swaps/${swap._id}`);
  } catch (error) {
    console.error('Reject swap error:', error);
    res.status(500).json({ error: 'Failed to reject swap' });
  }
});

// POST /swaps/:id/complete - Mark swap as completed
router.post('/:id/complete', async (req, res) => {
  try {
    const swap = await SkillSwap.findById(req.params.id);

    if (!swap || swap.status !== 'accepted') {
      return res.status(400).json({ error: 'Invalid request' });
    }

    const userId = req.session.user.id;
    const isParticipant = swap.requester.toString() === userId ||
                         swap.recipient.toString() === userId;

    if (!isParticipant) {
      return res.status(403).json({ error: 'Not authorized' });
    }

    await swap.updateStatus('completed');
    res.redirect(`/swaps/${swap._id}`);
  } catch (error) {
    console.error('Complete swap error:', error);
    res.status(500).json({ error: 'Failed to complete swap' });
  }
});

// POST /swaps/:id/cancel - Cancel swap request
router.post('/:id/cancel', async (req, res) => {
  try {
    const swap = await SkillSwap.findById(req.params.id);

    if (!swap || swap.requester.toString() !== req.session.user.id ||
        !['pending', 'accepted'].includes(swap.status)) {
      return res.status(400).json({ error: 'Invalid request' });
    }

    await swap.updateStatus('cancelled');
    res.redirect(`/swaps/${swap._id}`);
  } catch (error) {
    console.error('Cancel swap error:', error);
    res.status(500).json({ error: 'Failed to cancel swap' });
  }
});

// POST /swaps/:id/feedback - Leave feedback
router.post('/:id/feedback', [
  body('rating')
    .isInt({ min: 1, max: 5 })
    .withMessage('Rating must be between 1 and 5'),
  body('comment')
    .optional()
    .trim()
    .isLength({ max: 500 })
    .withMessage('Comment must be less than 500 characters')
], async (req, res) => {
  try {
    const errors = validationResult(req);

    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const swap = await SkillSwap.findById(req.params.id);
    const userId = req.session.user.id;

    // Check if user can leave feedback
    const feedbackCheck = await Feedback.canLeaveFeedback(swap._id, userId);
    if (!feedbackCheck.canLeave) {
      return res.status(400).json({ error: feedbackCheck.reason });
    }

    // Determine reviewee
    const revieweeId = swap.requester.toString() === userId ?
                      swap.recipient : swap.requester;

    const feedback = new Feedback({
      skillSwap: swap._id,
      reviewer: userId,
      reviewee: revieweeId,
      rating: req.body.rating,
      comment: req.body.comment || ''
    });

    await feedback.save();
    res.redirect(`/swaps/${swap._id}`);
  } catch (error) {
    console.error('Feedback error:', error);
    res.status(500).json({ error: 'Failed to submit feedback' });
  }
});

module.exports = router;
