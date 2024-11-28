// models/emotionaverage.js
const mongoose = require('mongoose');

/**
 * @swagger
 * components:
 *   schemas:
 *     EmotionAverage:
 *       type: object
 *       required:
 *         - count
 *         - date
 *         - face_confidence
 *         - emotion
 *       properties:
 *         count:
 *           type: number
 *           description: 인터뷰 회차
 *         date:
 *           type: string
 *           description: 분석 날짜 (YYYY-MM-DD)
 *         face_confidence:
 *           type: number
 *           description: 평균 얼굴 분석 신뢰도
 *         emotion:
 *           type: object
 *           properties:
 *             angry:
 *               type: number
 *             disgust:
 *               type: number
 *             fear:
 *               type: number
 *             happy:
 *               type: number
 *             neutral:
 *               type: number
 *             sad:
 *               type: number
 *             surprise:
 *               type: number
 */

const emotionAverageSchema = new mongoose.Schema({
  count: {
    type: Number,
    required: true
  },
  date: {
    type: String,
    required: true
  },
  face_confidence: {
    type: Number,
    required: true
  },
  emotion: {
    angry: Number,
    disgust: Number,
    fear: Number,
    happy: Number,
    neutral: Number,
    sad: Number,
    surprise: Number
  }
});

// 인덱스 추가
emotionAverageSchema.index({ count: 1 });
emotionAverageSchema.index({ date: 1 });

const EmotionAverage = mongoose.model('EmotionAverage', emotionAverageSchema, 'emotion_averages');

module.exports = EmotionAverage;