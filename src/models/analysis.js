const mongoose = require('mongoose');

/**
 * @swagger
 * components:
 *   schemas:
 *     Analysis:
 *       type: object
 *       required:
 *         - user_id
 *         - face_analysis
 *         - voice_analysis
 *         - result
 *       properties:
 *         _id:
 *           type: string
 *           description: 분석 결과의 고유 ID
 *         user_id:
 *           type: string
 *           description: 분석을 요청한 사용자의 ID
 *         face_analysis:
 *           type: object
 *           required:
 *             - emotion
 *             - score
 *           properties:
 *             emotion:
 *               type: string
 *               description: 감지된 감정 상태
 *             score:
 *               type: number
 *               description: 얼굴 분석 점수
 *         voice_analysis:
 *           type: object
 *           required:
 *             - stress_level
 *             - confidence
 *           properties:
 *             stress_level:
 *               type: number
 *               description: 감지된 스트레스 수준
 *             confidence:
 *               type: number
 *               description: 음성 분석의 신뢰도
 *         result:
 *           type: object
 *           required:
 *             - summary
 *           properties:
 *             summary:
 *               type: string
 *               description: 전반적인 분석 결과 요약
 *             detailed_scores:
 *               type: object
 *               properties:
 *                 category_1:
 *                   type: number
 *                   description: 카테고리 1 점수
 *                 category_2:
 *                   type: number
 *                   description: 카테고리 2 점수
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