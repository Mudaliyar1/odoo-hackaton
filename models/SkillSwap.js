const mongoose = require('mongoose');

const skillSwapSchema = new mongoose.Schema({
  requester: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  recipient: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  skillsOffered: [{
    type: String,
    required: true,
    trim: true
  }],
  skillsWanted: [{
    type: String,
    required: true,
    trim: true
  }],
  message: {
    type: String,
    maxlength: 500,
    trim: true
  },
  status: {
    type: String,
    enum: ['pending', 'accepted', 'rejected', 'completed', 'cancelled'],
    default: 'pending'
  },
  acceptedAt: {
    type: Date
  },
  completedAt: {
    type: Date
  },
  rejectedAt: {
    type: Date
  },
  cancelledAt: {
    type: Date
  },
  rejectionReason: {
    type: String,
    maxlength: 200
  },
  // For tracking mutual skills
  mutualSkills: [{
    type: String
  }]
}, {
  timestamps: true
});

// Index for efficient queries
skillSwapSchema.index({ requester: 1, status: 1 });
skillSwapSchema.index({ recipient: 1, status: 1 });
skillSwapSchema.index({ status: 1, createdAt: -1 });

// Pre-save middleware to identify mutual skills
skillSwapSchema.pre('save', async function(next) {
  if (this.isNew || this.isModified('skillsOffered') || this.isModified('skillsWanted')) {
    try {
      const User = mongoose.model('User');
      const recipient = await User.findById(this.recipient);
      
      if (recipient) {
        // Find mutual skills (skills both users offer)
        const requesterSkills = this.skillsOffered;
        const recipientSkills = recipient.skillsOffered;
        
        this.mutualSkills = requesterSkills.filter(skill => 
          recipientSkills.some(rSkill => 
            rSkill.toLowerCase() === skill.toLowerCase()
          )
        );
      }
    } catch (error) {
      console.error('Error finding mutual skills:', error);
    }
  }
  next();
});

// Static method to get user's swap statistics
skillSwapSchema.statics.getUserStats = async function(userId) {
  const stats = await this.aggregate([
    {
      $match: {
        $or: [
          { requester: new mongoose.Types.ObjectId(userId) },
          { recipient: new mongoose.Types.ObjectId(userId) }
        ]
      }
    },
    {
      $group: {
        _id: '$status',
        count: { $sum: 1 }
      }
    }
  ]);

  const result = {
    pending: 0,
    accepted: 0,
    completed: 0,
    rejected: 0,
    cancelled: 0,
    total: 0
  };

  stats.forEach(stat => {
    result[stat._id] = stat.count;
    result.total += stat.count;
  });

  return result;
};

// Instance method to update status
skillSwapSchema.methods.updateStatus = function(newStatus, reason = null) {
  this.status = newStatus;
  
  switch (newStatus) {
    case 'accepted':
      this.acceptedAt = new Date();
      break;
    case 'rejected':
      this.rejectedAt = new Date();
      if (reason) this.rejectionReason = reason;
      break;
    case 'completed':
      this.completedAt = new Date();
      break;
    case 'cancelled':
      this.cancelledAt = new Date();
      break;
  }
  
  return this.save();
};

module.exports = mongoose.model('SkillSwap', skillSwapSchema);
