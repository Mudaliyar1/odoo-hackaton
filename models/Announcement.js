const mongoose = require('mongoose');

const announcementSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true,
    trim: true,
    maxlength: 100
  },
  message: {
    type: String,
    required: true,
    trim: true,
    maxlength: 1000
  },
  type: {
    type: String,
    enum: ['info', 'warning', 'success', 'error'],
    default: 'info'
  },
  isActive: {
    type: Boolean,
    default: true
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  expiresAt: {
    type: Date
  },
  targetAudience: {
    type: String,
    enum: ['all', 'users', 'admins'],
    default: 'all'
  }
}, {
  timestamps: true
});

// Index for efficient queries
announcementSchema.index({ isActive: 1, expiresAt: 1, createdAt: -1 });

// Static method to get active announcements
announcementSchema.statics.getActiveAnnouncements = async function(userRole = 'user') {
  const now = new Date();
  
  const query = {
    isActive: true,
    $or: [
      { expiresAt: { $exists: false } },
      { expiresAt: null },
      { expiresAt: { $gt: now } }
    ]
  };

  // Filter by target audience
  if (userRole === 'admin') {
    query.targetAudience = { $in: ['all', 'admins'] };
  } else {
    query.targetAudience = { $in: ['all', 'users'] };
  }

  return this.find(query)
    .populate('createdBy', 'name')
    .sort({ createdAt: -1 })
    .limit(5);
};

module.exports = mongoose.model('Announcement', announcementSchema);
