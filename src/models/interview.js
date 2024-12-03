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
      required: true,
      min: 1,
      max: 3
    },
    score: {
      type: Number,
      required: true,
      min: 0,
      max: 100,
      validate: {
        validator: Number.isInteger,
        message: '{VALUE} is not an integer value'
      }
    }
  }],
  mean_score: {
    type: Number,
    required: true,
    min: 0,
    max: 100
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

// questions_answers 배열의 길이가 정확히 3인지 검증
interviewSchema.path('questions_answers').validate(function(value) {
  return value.length === 3;
}, 'questions_answers must contain exactly 3 items');

const Interview = mongoose.model('Interview', interviewSchema);
module.exports = Interview;