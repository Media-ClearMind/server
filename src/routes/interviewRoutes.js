const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const { body, param, query, validationResult } = require('express-validator');
const auth = require('../middleware/auth');
const Interview = require('../models/interview');
const Analysis = require('../models/analysis');
const User = require('../models/user');
const EmotionAverage = require('../models/emotionaverage');

// 표준화된 응답 생성 헬퍼 함수
const createResponse = (success, message, data = null, meta = null) => ({
  status: success ? 'success' : 'error',
  message,
  data,
  meta
});

// 유효성 검증 규칙
const validationRules = {
    submission: [
      body('questions_answers').isArray({ min: 3, max: 3 })
        .withMessage('Exactly 3 questions and answers are required'),
      body('questions_answers.*.question').notEmpty()
        .withMessage('Question is required'),
      body('questions_answers.*.answer').notEmpty()
        .withMessage('Answer is required'),
      body('questions_answers.*.order').isInt({ min: 1, max: 3 })
        .withMessage('Order must be between 1 and 3'),
      body('score').isInt({ min: 0, max: 100 })
        .withMessage('Score must be between 0 and 100'),
      body('analysis_results').isArray({ min: 1 })
        .withMessage('At least one analysis result is required'),
      body('analysis_results.*.result').isArray()
        .withMessage('Each analysis result must contain a result array')
    ]
  };

// 유효성 검증 미들웨어
const validateRequest = (rules) => {
  return async (req, res, next) => {
    await Promise.all(rules.map(validation => validation.run(req)));
    
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json(createResponse(
        false,
        'Validation failed',
        null,
        { errors: errors.array() }
      ));
    }
    next();
  };
};

// 감정 평균 계산 및 업데이트 함수
async function updateEmotionAverage(analysisResults, count, session) {
  try {
    // 현재 분석 결과들에서 감정 데이터 추출
    const currentEmotions = {};
    let totalConfidence = 0;

    // 모든 분석 결과의 감정 값 합산
    analysisResults.forEach(analysis => {
      const result = analysis.result[0];
      totalConfidence += result.face_confidence;
      
      Object.entries(result.emotion).forEach(([emotion, value]) => {
        currentEmotions[emotion] = (currentEmotions[emotion] || 0) + value;
      });
    });

    // 평균 계산
    const numResults = analysisResults.length;
    const averageConfidence = totalConfidence / numResults;
    const averageEmotions = {};
    Object.entries(currentEmotions).forEach(([emotion, total]) => {
      averageEmotions[emotion] = Number((total / numResults).toFixed(3));
    });

    // 새로운 평균 데이터 생성
    const newAverage = {
      count,
      date: new Date().toISOString().split('T')[0],
      face_confidence: Number(averageConfidence.toFixed(2)),
      emotion: averageEmotions,
      total_analyses: numResults
    };

    // upsert로 업데이트 또는 생성
    await EmotionAverage.updateOne(
      { count },
      { $set: newAverage },
      { upsert: true, session }
    );

    return true;
  } catch (error) {
    console.error('Error updating emotion average:', error);
    throw error;
  }
}

/**
 * @swagger
 * /api/interviews/submit:
 *   post:
 *     summary: 인터뷰 결과 및 분석 데이터 제출
 *     description: 인터뷰의 Q&A 데이터, 점수, 안면 감정 분석 결과들을 함께 제출합니다.
 *     tags: [Interviews]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - questions_answers
 *               - score
 *               - analysis_results
 *             properties:
 *               questions_answers:
 *                 type: array
 *                 minItems: 3
 *                 maxItems: 3
 *                 description: 3개의 질문-답변 세트
 *                 example: [
 *                   {
 *                     "question": "본인의 장점을 말씀해주세요",
 *                     "answer": "저는 어떤 일이든 끝까지 책임감을 가지고 마무리하는 것이 장점입니다",
 *                     "order": 1
 *                   },
 *                   {
 *                     "question": "지원동기가 무엇인가요?",
 *                     "answer": "귀사의 혁신적인 기술과 발전 가능성을 보고 지원하게 되었습니다",
 *                     "order": 2
 *                   },
 *                   {
 *                     "question": "입사 후 포부를 말씀해주세요",
 *                     "answer": "회사의 성장과 함께 저도 성장하는 인재가 되고 싶습니다",
 *                     "order": 3
 *                   }
 *                 ]
 *               score:
 *                 type: integer
 *                 minimum: 0
 *                 maximum: 100
 *                 description: 인터뷰 점수
 *                 example: 85
 *               analysis_results:
 *                 type: array
 *                 minItems: 1
 *                 description: 안면 감정 분석 결과들 (각 질문-답변마다 2회씩, 총 6회)
 *                 example: [
 *                   {
 *                     "timestamp": "2024-03-12T14:30:00.000Z",
 *                     "result": [{
 *                       "age": 28,
 *                       "dominant_emotion": "neutral",
 *                       "dominant_gender": "Man",
 *                       "emotion": {
 *                         "angry": 0.02,
 *                         "disgust": 0.01,
 *                         "fear": 0.01,
 *                         "happy": 0.15,
 *                         "neutral": 0.75,
 *                         "sad": 0.03,
 *                         "surprise": 0.03
 *                       },
 *                       "face_confidence": 0.98
 *                     }]
 *                   },
 *                   {
 *                     "timestamp": "2024-03-12T14:30:30.000Z",
 *                     "result": [{
 *                       "age": 28,
 *                       "dominant_emotion": "happy",
 *                       "dominant_gender": "Man",
 *                       "emotion": {
 *                         "angry": 0.01,
 *                         "disgust": 0.01,
 *                         "fear": 0.01,
 *                         "happy": 0.65,
 *                         "neutral": 0.28,
 *                         "sad": 0.02,
 *                         "surprise": 0.02
 *                       },
 *                       "face_confidence": 0.99
 *                     }]
 *                   },
 *                   {
 *                     "timestamp": "2024-03-12T14:31:00.000Z",
 *                     "result": [{
 *                       "age": 28,
 *                       "dominant_emotion": "neutral",
 *                       "dominant_gender": "Man",
 *                       "emotion": {
 *                         "angry": 0.02,
 *                         "disgust": 0.01,
 *                         "fear": 0.02,
 *                         "happy": 0.20,
 *                         "neutral": 0.70,
 *                         "sad": 0.03,
 *                         "surprise": 0.02
 *                       },
 *                       "face_confidence": 0.97
 *                     }]
 *                   },
 *                   {
 *                     "timestamp": "2024-03-12T14:31:30.000Z",
 *                     "result": [{
 *                       "age": 28,
 *                       "dominant_emotion": "happy",
 *                       "dominant_gender": "Man",
 *                       "emotion": {
 *                         "angry": 0.01,
 *                         "disgust": 0.01,
 *                         "fear": 0.01,
 *                         "happy": 0.55,
 *                         "neutral": 0.38,
 *                         "sad": 0.02,
 *                         "surprise": 0.02
 *                       },
 *                       "face_confidence": 0.98
 *                     }]
 *                   },
 *                   {
 *                     "timestamp": "2024-03-12T14:32:00.000Z",
 *                     "result": [{
 *                       "age": 28,
 *                       "dominant_emotion": "neutral",
 *                       "dominant_gender": "Man",
 *                       "emotion": {
 *                         "angry": 0.02,
 *                         "disgust": 0.01,
 *                         "fear": 0.01,
 *                         "happy": 0.25,
 *                         "neutral": 0.65,
 *                         "sad": 0.03,
 *                         "surprise": 0.03
 *                       },
 *                       "face_confidence": 0.98
 *                     }]
 *                   },
 *                   {
 *                     "timestamp": "2024-03-12T14:32:30.000Z",
 *                     "result": [{
 *                       "age": 28,
 *                       "dominant_emotion": "happy",
 *                       "dominant_gender": "Man",
 *                       "emotion": {
 *                         "angry": 0.01,
 *                         "disgust": 0.01,
 *                         "fear": 0.01,
 *                         "happy": 0.60,
 *                         "neutral": 0.33,
 *                         "sad": 0.02,
 *                         "surprise": 0.02
 *                       },
 *                       "face_confidence": 0.99
 *                     }]
 *                   }
 *                 ]
 *     responses:
 *       201:
 *         description: 인터뷰 제출 성공
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               example:
 *                 status: success
 *                 message: Interview submitted successfully
 *                 data:
 *                   interview_count: 1
 *                   interview_id: "507f1f77bcf86cd799439011"
 *                   score: 85
 *       400:
 *         description: 잘못된 요청 (유효성 검증 실패)
 *       401:
 *         description: 인증되지 않은 접근
 *       500:
 *         description: 서버 에러
 */
router.post('/submit', auth(), validateRequest(validationRules.submission), 
  async (req, res) => {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      const { questions_answers, score, analysis_results } = req.body;

      // 사용자의 count 증가
      const user = await User.findByIdAndUpdate(
        req.user.user_id,
        { $inc: { count: 1 } },
        { new: true, session }
      );

      // 감정 평균 업데이트
      await updateEmotionAverage(analysis_results, user.count, session);

      // 분석 결과들 저장
      const analysisPromises = analysis_results.map(analysisResult => {
        const analysis = new Analysis({
          userId: new mongoose.Types.ObjectId(req.user.user_id),
          count: user.count,
          serverTimestamp: analysisResult.timestamp,
          analysis_result: analysisResult.result,
          result: {
            status: 'completed',
            final_score: null
          }
        });
        return analysis.save({ session });
      });

      await Promise.all(analysisPromises);

      // 인터뷰 데이터 저장
      const interview = new Interview({
        user_id: req.user.user_id,
        interview_count: user.count,
        questions_answers: questions_answers.sort((a, b) => a.order - b.order),
        score
      });

      await interview.save({ session });
      await session.commitTransaction();

      res.status(201).json(createResponse(
        true,
        'Interview submitted successfully',
        {
          interview_count: user.count,
          interview_id: interview._id,
          score
        }
      ));
    } catch (error) {
      await session.abortTransaction();
      console.error('Interview submission error:', error);
      res.status(500).json(createResponse(false, 'Failed to submit interview'));
    } finally {
      session.endSession();
    }
  }
);

/**
 * @swagger
 * /api/interviews/history:
 *   get:
 *     summary: 사용자의 인터뷰 히스토리 조회
 *     description: 페이지네이션이 적용된 인터뷰 기록과 관련 분석 정보를 최신순으로 조회합니다.
 *     tags: [Interviews]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           minimum: 1
 *           default: 1
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 100
 *           default: 20
 *     responses:
 *       200:
 *         description: 조회 성공
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: success
 *                 message:
 *                   type: string
 *                 data:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       interview_data:
 *                         type: object
 *                         properties:
 *                           user_id:
 *                             type: string
 *                           interview_count:
 *                             type: integer
 *                           questions_answers:
 *                             type: array
 *                           score:
 *                             type: number
 *                           createdAt:
 *                             type: string
 *                       analysis_summary:
 *                         type: object
 *                         properties:
 *                           analysis_id:
 *                             type: string
 *                           status:
 *                             type: string
 *                           final_score:
 *                             type: number
 *                           completed_at:
 *                             type: string
 */
router.get(
  '/history',
  auth(),
  validateRequest(validationRules.pagination),
  async (req, res) => {
    try {
      const page = parseInt(req.query.page) || 1;
      const limit = parseInt(req.query.limit) || 20;
      const skip = (page - 1) * limit;

      const [interviews, total] = await Promise.all([
        Interview.find({ user_id: req.user.user_id })
          .sort({ createdAt: -1 })
          .skip(skip)
          .limit(limit)
          .select('-__v'),
        Interview.countDocuments({ user_id: req.user.user_id })
      ]);

      // 각 인터뷰에 대한 분석 정보 조회
      const interviewsWithAnalysis = await Promise.all(
        interviews.map(async (interview) => {
          const analysis = await Analysis.findOne({
            user_id: req.user.user_id,
            interview_count: interview.interview_count
          }).select('_id result.status result.final_score createdAt');

          return {
            interview_data: {
              ...interview.toObject(),
            },
            analysis_summary: analysis ? {
              analysis_id: analysis._id,
              status: analysis.result?.status || 'pending',
              final_score: analysis.result?.final_score,
              completed_at: analysis.createdAt
            } : null
          };
        })
      );

      // 캐싱 설정 (5분)
      res.set('Cache-Control', 'private, max-age=300');

      res.json(createResponse(
        true,
        'Interview history retrieved successfully',
        interviewsWithAnalysis,
        {
          pagination: {
            total,
            page,
            limit,
            totalPages: Math.ceil(total / limit)
          }
        }
      ));
    } catch (error) {
      console.error('Interview history fetch error:', error);
      res.status(500).json(createResponse(
        false,
        'Failed to fetch interview history'
      ));
    }
  }
);

/**
 * @swagger
 * /api/interviews/detail:
 *   get:
 *     summary: 특정 회차의 인터뷰 상세 조회
 *     description: 특정 회차의 인터뷰 내용과 관련 분석 정보를 상세 조회합니다.
 *     tags: [Interviews]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: count
 *         required: true
 *         schema:
 *           type: integer
 *           minimum: 1
 *         description: 조회할 인터뷰 회차 번호
 *     responses:
 *       200:
 *         description: 인터뷰 조회 성공
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: success
 *                 message:
 *                   type: string
 *                 data:
 *                   type: object
 *                   properties:
 *                     interview_data:
 *                       type: object
 *                       properties:
 *                         user_id:
 *                           type: string
 *                         interview_count:
 *                           type: integer
 *                         questions_answers:
 *                           type: array
 *                           items:
 *                             type: object
 *                             properties:
 *                               question:
 *                                 type: string
 *                               answer:
 *                                 type: string
 *                               order:
 *                                 type: integer
 *                         score:
 *                           type: number
 *                         createdAt:
 *                           type: string
 *                           format: date-time
 *                     analysis_info:
 *                       type: object
 *                       nullable: true
 *                       properties:
 *                         analysis_id:
 *                           type: string
 *                         status:
 *                           type: string
 *                           enum: [pending, completed]
 *                         completed_at:
 *                           type: string
 *                           format: date-time
 *       400:
 *         description: 잘못된 요청
 *       401:
 *         description: 인증되지 않은 접근
 *       404:
 *         description: 인터뷰를 찾을 수 없음
 *       500:
 *         description: 서버 에러
 */

router.get(
    '/detail',
    auth(),
    [
      query('count').isInt({ min: 1 }).withMessage('Interview count must be a positive integer')
    ],
    async (req, res) => {
        try {
            const errors = validationResult(req);
            if (!errors.isEmpty()) {
                return res.status(400).json(createResponse(
                    false,
                    'Validation failed',
                    null,
                    { errors: errors.array() }
                ));
            }

            const interview = await Interview.findOne({
                user_id: new mongoose.Types.ObjectId(req.user.user_id),
                interview_count: parseInt(req.query.count)
            });

            if (!interview) {
                return res.status(404).json(createResponse(
                    false,
                    'Interview not found'
                ));
            }

            // 관련된 분석 결과 조회
            const analysis = await Analysis.findOne({
                userId: new mongoose.Types.ObjectId(req.user.user_id),
                count: parseInt(req.query.count)
            }).select('_id createdAt result.status');

            // 캐싱 설정 (5분)
            res.set('Cache-Control', 'private, max-age=300');

            res.json(createResponse(
                true,
                'Interview retrieved successfully',
                {
                    interview_data: {
                        user_id: interview.user_id,
                        interview_count: interview.interview_count,
                        questions_answers: interview.questions_answers,
                        score: interview.score,
                        createdAt: interview.createdAt
                    },
                    analysis_info: analysis ? {
                        analysis_id: analysis._id,
                        status: analysis.result?.status || 'pending',
                        completed_at: analysis.createdAt
                    } : null
                }
            ));
        } catch (error) {
            console.error('Interview fetch error:', error);
            
            const errorMessage = error.name === 'CastError' 
                ? 'Invalid interview count format'
                : 'Failed to fetch interview';
            
            res.status(500).json(createResponse(
                false,
                errorMessage,
                null,
                { error: error.message }
            ));
        }
    }
);

module.exports = router;