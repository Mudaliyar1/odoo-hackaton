const mongoose = require('mongoose');

const contactSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true,
    maxlength: 100
  },
  email: {
    type: String,
    required: true,
    trim: true,
    lowercase: true
  },
  subject: {
    type: String,
    required: true,
    enum: ['technical', 'account', 'swap', 'feedback', 'other'],
    default: 'other'
  },
  message: {
    type: String,
    required: true,
    trim: true,
    maxlength: 2000
  },
  status: {
    type: String,
    enum: ['new', 'in-progress', 'resolved', 'closed'],
    default: 'new'
  },
  priority: {
    type: String,
    enum: ['low', 'medium', 'high', 'urgent'],
    default: 'medium'
  },
  assignedTo: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },
  adminNotes: {
    type: String,
    trim: true,
    maxlength: 1000,
    default: ''
  },
  userAgent: {
    type: String,
    default: ''
  },
  ipAddress: {
    type: String,
    default: ''
  },
  isRead: {
    type: Boolean,
    default: false
  },
  resolvedAt: {
    type: Date,
    default: null
  },
  resolvedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  }
}, {
  timestamps: true
});

// Index for efficient queries
contactSchema.index({ status: 1, createdAt: -1 });
contactSchema.index({ email: 1 });
contactSchema.index({ subject: 1 });

// Virtual for formatted subject
contactSchema.virtual('subjectFormatted').get(function() {
  const subjects = {
    'technical': 'Technical Support',
    'account': 'Account Issues',
    'swap': 'Swap Problems',
    'feedback': 'Feedback & Suggestions',
    'other': 'Other'
  };
  return subjects[this.subject] || 'Other';
});

// Virtual for status badge class
contactSchema.virtual('statusBadgeClass').get(function() {
  const classes = {
    'new': 'bg-primary',
    'in-progress': 'bg-warning',
    'resolved': 'bg-success',
    'closed': 'bg-secondary'
  };
  return classes[this.status] || 'bg-secondary';
});

// Virtual for priority badge class
contactSchema.virtual('priorityBadgeClass').get(function() {
  const classes = {
    'low': 'bg-info',
    'medium': 'bg-primary',
    'high': 'bg-warning',
    'urgent': 'bg-danger'
  };
  return classes[this.priority] || 'bg-primary';
});

// Method to mark as read
contactSchema.methods.markAsRead = function() {
  this.isRead = true;
  return this.save();
};

// Method to update status
contactSchema.methods.updateStatus = function(status, adminId = null) {
  this.status = status;
  if (status === 'resolved' || status === 'closed') {
    this.resolvedAt = new Date();
    if (adminId) {
      this.resolvedBy = adminId;
    }
  }
  return this.save();
};

// Static method to get statistics
contactSchema.statics.getStats = async function() {
  const stats = await this.aggregate([
    {
      $group: {
        _id: '$status',
        count: { $sum: 1 }
      }
    }
  ]);

  const result = {
    total: 0,
    new: 0,
    inProgress: 0,
    resolved: 0,
    closed: 0
  };

  stats.forEach(stat => {
    result.total += stat.count;
    switch (stat._id) {
      case 'new':
        result.new = stat.count;
        break;
      case 'in-progress':
        result.inProgress = stat.count;
        break;
      case 'resolved':
        result.resolved = stat.count;
        break;
      case 'closed':
        result.closed = stat.count;
        break;
    }
  });

  return result;
};

module.exports = mongoose.model('Contact', contactSchema);
