const mongoose = require('mongoose');

const interviewSchema = new mongoose.Schema({
  user_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  interview_count: {
    type: Number,
    required: true
  },
  questions_answers: [{
    question: {
      type: String,
      required: true
    },
    answer: {
      type: String,
      required: true
    },
    order: {
      type: Number,
      required: true
    }
  }],
  score: {
    type: Number,
    required: true,
    min: 0,
    max: 100,
    validate: {
      validator: Number.isInteger,
      message: '{VALUE} is not an integer value'
    }
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

const Interview = mongoose.model('Interview', interviewSchema);
module.exports = Interview;