const mongoose = require('mongoose');

/**
 * @swagger
 * components:
 *   schemas:
 *     Analysis:
 *       type: object
 *       required:
 *         - user_id
 *         - count
 *         - date
 *         - face_confidence
 *         - emotion
 *       properties:
 *         _id:
 *           type: string
 *           description: 분석 결과의 고유 ID
 *         user_id:
 *           type: string
 *           description: 분석을 요청한 사용자의 ID
 *         count:
 *           type: number
 *           description: 인터뷰 회차
 *         date:
 *           type: string
 *           description: 분석 날짜 (YYYY-MM-DD)
 *         face_confidence:
 *           type: number
 *           description: 얼굴 분석 신뢰도 점수
 *         emotion:
 *           type: object
 *           properties:
 *             angry:
 *               type: number
 *               description: 화남 감정 점수
 *             disgust:
 *               type: number
 *               description: 혐오 감정 점수
 *             fear:
 *               type: number
 *               description: 공포 감정 점수
 *             happy:
 *               type: number
 *               description: 행복 감정 점수
 *             neutral:
 *               type: number
 *               description: 중립 감정 점수
 *             sad:
 *               type: number
 *               description: 슬픔 감정 점수
 *             surprise:
 *               type: number
 *               description: 놀람 감정 점수
 *         final_score:
 *           type: number
 *           description: 최종 점수 (0-100)
 *         createdAt:
 *           type: string
 *           format: date-time
 *           description: 분석이 생성된 시간
 */

const analysisSchema = new mongoose.Schema({
  user_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
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
  },
  final_score: {
    type: Number,
    min: 0,
    max: 100
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

const Analysis = mongoose.model('Analysis', analysisSchema);

module.exports = Analysis;