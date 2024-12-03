const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const { body, validationResult } = require('express-validator');
const auth = require('../middleware/auth');
const Interview = require('../models/interview');
const Analysis = require('../models/analysis');
const User = require('../models/user');
const EmotionAverage = require('../models/emotionaverage');
const Result = require('../models/result');

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
    body('questions_answers.*.score').isInt({ min: 0, max: 100 })
      .withMessage('Score must be between 0 and 100'),
    body('mean_score').isFloat({ min: 0, max: 100 })
      .withMessage('Mean score must be between 0 and 100'),
    body('analysis_results').isArray({ min: 6, max: 6 })
      .withMessage('Exactly 6 analysis results are required'),
    body('analysis_results.*.timestamp').isISO8601()
      .withMessage('Valid timestamp is required'),
    body('analysis_results.*.result').isArray({ min: 1, max: 1 })
      .withMessage('Each analysis result must contain exactly one result object'),
    body('analysis_results.*.result.*.face_confidence').isFloat({ min: 0, max: 1 })
      .withMessage('Face confidence must be between 0 and 1'),
    body('analysis_results.*.result.*.dominant_emotion').isString()
      .withMessage('Dominant emotion must be a string'),
    body('analysis_results.*.result.*.emotion').isObject()
      .withMessage('Emotion data must be an object')
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
    const currentEmotions = {};
    let totalConfidence = 0;

    analysisResults.forEach(analysis => {
      const result = analysis.result[0];
      totalConfidence += result.face_confidence;
      
      Object.entries(result.emotion).forEach(([emotion, value]) => {
        currentEmotions[emotion] = (currentEmotions[emotion] || 0) + value;
      });
    });

    const numResults = analysisResults.length;
    const averageConfidence = totalConfidence / numResults;
    const averageEmotions = {};
    
    Object.entries(currentEmotions).forEach(([emotion, total]) => {
      averageEmotions[emotion] = Number((total / numResults).toFixed(3));
    });

    const newAverage = {
      count,
      date: new Date().toISOString().split('T')[0],
      face_confidence: Number(averageConfidence.toFixed(3)),
      emotion: averageEmotions,
      total_analyses: numResults
    };

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
 *                     "question": "본인의 이름이 무엇인가요?",
 *                     "answer": "제 이름은 곽재헌일까요?",
 *                     "score": 74,
 *                     "order": 1
 *                   },
 *                   {
 *                     "question": "본인의 배우자 이름이 무엇인가요?",
 *                     "answer": "김민태일까요?",
 *                     "score": 82,
 *                     "order": 2
 *                   },
 *                   {
 *                     "question": "다시 한 번 말씀해주시겠어요?",
 *                     "answer": "장유태일까요?",
 *                     "score": 68,
 *                     "order": 3
 *                   }
 *                 ]
 *               mean_score:
 *                 type: number
 *                 minimum: 0
 *                 maximum: 100
 *                 description: 전체 질문에 대한 평균 점수
 *                 example: 74.7
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
 *                   result_id: "507f1f77bcf86cd799439012"
 *                   mean_score: 74.7
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
      const { questions_answers, mean_score, analysis_results } = req.body;

      // 데이터 정렬 및 검증
      const sortedQA = questions_answers.sort((a, b) => a.order - b.order);
      
      // 순서가 1,2,3인지 확인
      const validOrder = sortedQA.every((qa, idx) => qa.order === idx + 1);
      if (!validOrder) {
        throw new Error('Invalid question order sequence');
      }

      // mean_score 검증
      const calculatedMeanScore = Number((sortedQA.reduce((sum, qa) => sum + qa.score, 0) / 3).toFixed(1));
      if (Math.abs(calculatedMeanScore - mean_score) > 0.1) {  // 부동소수점 오차 허용
        throw new Error('Provided mean score does not match calculated mean');
      }

      // 1. 사용자의 count 증가
      const user = await User.findByIdAndUpdate(
        req.user.user_id,
        { $inc: { count: 1 } },
        { new: true, session }
      );

      // 2. 분석 결과들 저장
      const analysisPromises = analysis_results.map(analysisResult => {
        const analysis = new Analysis({
          userId: new mongoose.Types.ObjectId(req.user.user_id),
          count: user.count,
          serverTimestamp: new Date(analysisResult.timestamp),
          result: analysisResult.result,
          status: 'completed'
        });
        return analysis.save({ session });
      });

      const savedAnalyses = await Promise.all(analysisPromises);

      // 3. 인터뷰 데이터 저장
      const interview = new Interview({
        user_id: req.user.user_id,
        interview_count: user.count,
        questions_answers: sortedQA,
        mean_score
      });

      await interview.save({ session });

      // 4. 감정 분석 평균 업데이트
      await updateEmotionAverage(analysis_results, user.count, session);

      // 5. 결과 데이터 저장
      const result = new Result({
        user_id: req.user.user_id,
        interview_count: user.count,
        date: new Date().toISOString().split('T')[0],
        interview_data: {
          questions_answers: sortedQA,
          mean_score
        },
        analysis_average: {
          face_confidence: Number((analysis_results.reduce((sum, ar) => 
            sum + ar.result[0].face_confidence, 0) / analysis_results.length).toFixed(3)),
          emotion: Object.fromEntries(
            Object.entries(
              analysis_results.reduce((acc, ar) => {
                Object.entries(ar.result[0].emotion).forEach(([emotion, value]) => {
                  acc[emotion] = (acc[emotion] || 0) + value;
                });
                return acc;
              }, {})
            ).map(([emotion, sum]) => [
              emotion, 
              Number((sum / analysis_results.length).toFixed(3))
            ])
          ),
          total_analyses: analysis_results.length
        }
      });

      await result.save({ session });

      await session.commitTransaction();

      res.status(201).json(createResponse(
        true,
        'Interview submitted successfully',
        {
          interview_count: user.count,
          interview_id: interview._id,
          result_id: result._id,
          mean_score,
          analysis_ids: savedAnalyses.map(analysis => analysis._id)
        }
      ));
    } catch (error) {
      await session.abortTransaction();
      console.error('Interview submission error:', error);
      res.status(500).json(createResponse(
        false, 
        error.message || 'Failed to submit interview'
      ));
    } finally {
      session.endSession();
    }
  }
);

module.exports = router;