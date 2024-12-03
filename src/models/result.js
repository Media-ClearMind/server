const mongoose = require('mongoose');

const resultSchema = new mongoose.Schema({
  user_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  interview_count: {
    type: Number,
    required: true,
    min: 1
  },
  date: {
    type: String,
    required: true,
    validate: {
      validator: function(v) {
        return /^\d{4}-\d{2}-\d{2}$/.test(v);
      },
      message: props => `${props.value} is not a valid date format (YYYY-MM-DD)!`
    }
  },
  interview_data: {
    questions_answers: [{
      question: {
        type: String,
        required: true
      },
      answer: {
        type: String,
        required: true
      },
      score: {
        type: Number,
        required: true,
        min: 0,
        max: 100
      },
      order: {
        type: Number,
        required: true,
        min: 1,
        max: 3
      }
    }],
    mean_score: {
      type: Number,
      required: true,
      min: 0,
      max: 100
    }
  },
  analysis_average: {
    face_confidence: {
      type: Number,
      required: true,
      min: 0,
      max: 1
    },
    emotion: {
      angry: { type: Number, required: true },
      disgust: { type: Number, required: true },
      fear: { type: Number, required: true },
      happy: { type: Number, required: true },
      neutral: { type: Number, required: true },
      sad: { type: Number, required: true },
      surprise: { type: Number, required: true }
    },
    total_analyses: {
      type: Number,
      required: true
    }
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

resultSchema.index({ user_id: 1, interview_count: 1 }, { unique: true });

const Result = mongoose.model('Result', resultSchema);

module.exports = Result;