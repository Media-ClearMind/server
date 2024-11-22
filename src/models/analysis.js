const mongoose = require('mongoose');

const analysisSchema = new mongoose.Schema({
  user_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  face_analysis: {
    emotion: {
      type: String,
      required: true
    },
    score: {
      type: Number,
      required: true
    }
  },
  voice_analysis: {
    stress_level: {
      type: Number,
      required: true
    },
    confidence: {
      type: Number,
      required: true
    }
  },
  result: {
    summary: {
      type: String,
      required: true
    },
    detailed_scores: {
      category_1: Number,
      category_2: Number
    }
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

const Analysis = mongoose.model('Analysis', analysisSchema);

module.exports = Analysis;