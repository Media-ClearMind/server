const mongoose = require('mongoose');

/**
 * @swagger
 * components:
 *   schemas:
 *     Analysis:
 *       type: object
 *       required:
 *         - userId
 *         - count
 *         - serverTimestamp
 *         - analysis_result
 *       properties:
 *         _id:
 *           type: string
 *           description: 분석 결과의 고유 ID
 *         userId:
 *           type: string
 *           description: 분석을 요청한 사용자의 ID
 *         count:
 *           type: number
 *           description: 인터뷰 회차
 *         serverTimestamp:
 *           type: string
 *           format: date-time
 *           description: 서버에서 분석된 시간
 *         analysis_result:
 *           type: array
 *           items:
 *             type: object
 *             properties:
 *               age:
 *                 type: number
 *                 description: 추정 나이
 *               dominant_emotion:
 *                 type: string
 *                 description: 주요 감정
 *               dominant_gender:
 *                 type: string
 *                 description: 주요 성별
 *               emotion:
 *                 type: object
 *                 properties:
 *                   angry:
 *                     type: number
 *                   disgust:
 *                     type: number
 *                   fear:
 *                     type: number
 *                   happy:
 *                     type: number
 *                   neutral:
 *                     type: number
 *                   sad:
 *                     type: number
 *                   surprise:
 *                     type: number
 *               face_confidence:
 *                 type: number
 *                 description: 얼굴 분석 신뢰도
 *               gender:
 *                 type: object
 *                 properties:
 *                   Woman:
 *                     type: number
 *                   Man:
 *                     type: number
 *               region:
 *                 type: object
 *                 properties:
 *                   x:
 *                     type: number
 *                   y:
 *                     type: number
 *                   w:
 *                     type: number
 *                   h:
 *                     type: number
 *                   left_eye:
 *                     type: array
 *                     items:
 *                       type: number
 *                   right_eye:
 *                     type: array
 *                     items:
 *                       type: number
 *         status:
 *           type: string
 *           enum: ['pending', 'completed']
 *           description: 분석 상태
 */

// 하위 스키마 정의
const regionSchema = new mongoose.Schema({
  x: Number,
  y: Number,
  w: Number,
  h: Number,
  left_eye: [Number],
  right_eye: [Number]
}, { _id: false });

const emotionSchema = new mongoose.Schema({
  angry: Number,
  disgust: Number,
  fear: Number,
  happy: Number,
  sad: Number,
  surprise: Number,
  neutral: Number
}, { _id: false });

const genderSchema = new mongoose.Schema({
  Woman: Number,
  Man: Number
}, { _id: false });

const analysisResultSchema = new mongoose.Schema({
  age: Number,
  dominant_emotion: String,
  dominant_gender: String,
  emotion: emotionSchema,
  face_confidence: Number,
  gender: genderSchema,
  region: regionSchema
}, { _id: false });

// 메인 스키마
const analysisSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  count: {
    type: Number,
    required: true
  },
  serverTimestamp: {
    type: Date,
    required: true
  },
  analysis_result: [analysisResultSchema],
  status: {
    type: String,
    enum: ['pending', 'completed'],
    default: 'completed'
  }
});

// 인덱스 추가
analysisSchema.index({ userId: 1, count: 1 });
analysisSchema.index({ serverTimestamp: -1 });

const Analysis = mongoose.model('Analysis', analysisSchema, 'face_analysis');

module.exports = Analysis;