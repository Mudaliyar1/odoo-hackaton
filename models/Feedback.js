const mongoose = require('mongoose');

const feedbackSchema = new mongoose.Schema({
  skillSwap: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'SkillSwap',
    required: true
  },
  reviewer: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  reviewee: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  rating: {
    type: Number,
    required: true,
    min: 1,
    max: 5
  },
  comment: {
    type: String,
    maxlength: 500,
    trim: true
  },
  skillsRated: [{
    skill: { type: String, required: true },
    rating: { type: Number, min: 1, max: 5, required: true }
  }],
  isPublic: {
    type: Boolean,
    default: true
  },
  isReported: {
    type: Boolean,
    default: false
  },
  reportReason: {
    type: String,
    maxlength: 200
  }
}, {
  timestamps: true
});

// Compound index to ensure one feedback per user per swap
feedbackSchema.index({ skillSwap: 1, reviewer: 1 }, { unique: true });

// Index for efficient queries
feedbackSchema.index({ reviewee: 1, isPublic: 1, createdAt: -1 });
feedbackSchema.index({ reviewer: 1, createdAt: -1 });

// Post-save middleware to update user rating
feedbackSchema.post('save', async function(doc) {
  try {
    const User = mongoose.model('User');
    const user = await User.findById(doc.reviewee);
    
    if (user) {
      await user.updateRating(doc.rating);
    }
  } catch (error) {
    console.error('Error updating user rating:', error);
  }
});

// Static method to get user's feedback statistics
feedbackSchema.statics.getUserFeedbackStats = async function(userId) {
  const stats = await this.aggregate([
    {
      $match: {
        reviewee: new mongoose.Types.ObjectId(userId),
        isPublic: true
      }
    },
    {
      $group: {
        _id: '$rating',
        count: { $sum: 1 }
      }
    },
    {
      $sort: { _id: 1 }
    }
  ]);

  const result = {
    1: 0, 2: 0, 3: 0, 4: 0, 5: 0,
    total: 0,
    average: 0
  };

  let totalRating = 0;
  stats.forEach(stat => {
    result[stat._id] = stat.count;
    result.total += stat.count;
    totalRating += stat._id * stat.count;
  });

  if (result.total > 0) {
    result.average = (totalRating / result.total).toFixed(1);
  }

  return result;
};

// Static method to check if user can leave feedback
feedbackSchema.statics.canLeaveFeedback = async function(swapId, userId) {
  const SkillSwap = mongoose.model('SkillSwap');
  
  // Check if swap is completed
  const swap = await SkillSwap.findById(swapId);
  if (!swap || swap.status !== 'completed') {
    return { canLeave: false, reason: 'Swap must be completed first' };
  }

  // Check if user is part of the swap
  const isParticipant = swap.requester.toString() === userId || 
                       swap.recipient.toString() === userId;
  if (!isParticipant) {
    return { canLeave: false, reason: 'You are not part of this swap' };
  }

  // Check if feedback already exists
  const existingFeedback = await this.findOne({
    skillSwap: swapId,
    reviewer: userId
  });

  if (existingFeedback) {
    return { canLeave: false, reason: 'You have already left feedback for this swap' };
  }

  return { canLeave: true };
};

module.exports = mongoose.model('Feedback', feedbackSchema);
