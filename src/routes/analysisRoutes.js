const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const { body, param, query, validationResult } = require('express-validator');
const auth = require('../middleware/auth');
const Analysis = require('../models/analysis');
const Interview = require('../models/interview');        // 추가
const EmotionAverage = require('../models/emotionaverage');  // 추가

// 표준화된 응답 생성 헬퍼 함수
const createResponse = (success, message, data = null, meta = null) => ({
  status: success ? 'success' : 'error',
  message,
  data,
  meta
});

// 유효성 검증 규칙
const validationRules = {
  analysisId: param('analysis_id').isMongoId(),
  userId: param('user_id').isMongoId(),
  interviewCount: param('interview_count').isInt({ min: 1 }),
  dateRange: [
    query('startDate').optional().isISO8601(),
    query('endDate').optional().isISO8601()
  ],
  score: [
    body('final_score').isFloat({ min: 0, max: 100 }),
    body('emotion_scores').isObject().optional()
      .custom((scores) => {
        const validEmotions = ['angry', 'disgust', 'fear', 'happy', 'sad', 'surprise', 'neutral'];
        const emotions = Object.keys(scores);
        return emotions.every(emotion => 
          validEmotions.includes(emotion) && 
          typeof scores[emotion] === 'number' && 
          scores[emotion] >= 0 && 
          scores[emotion] <= 100
        );
      })
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

// 사용자 권한 검증 미들웨어
const verifyUserAccess = async (req, res, next) => {
  try {
    const userId = req.params.user_id || req.user.user_id;
    if (userId !== req.user.user_id) {
      return res.status(403).json(createResponse(
        false,
        'Unauthorized access'
      ));
    }
    next();
  } catch (error) {
    res.status(500).json(createResponse(false, 'Authorization check failed'));
  }
};

// 감정 점수 검증 유틸리티 함수
const validateEmotionScores = (scores) => {
    if (!scores) return false;
    const validEmotions = ['angry', 'disgust', 'fear', 'happy', 'neutral', 'sad', 'surprise'];
    return validEmotions.every(emotion => 
      typeof scores[emotion] === 'number' && 
      scores[emotion] >= 0 && 
      scores[emotion] <= 100
    );
  };
  
  // 분석 데이터 포맷팅 유틸리티 함수
  const formatAnalysis = (analysis) => ({
    analysis_id: analysis._id,
    date: analysis.createdAt,
    face_analysis: {
      confidence: Number(analysis.face_analysis.confidence.toFixed(2)),
      emotion_scores: Object.fromEntries(
        Object.entries(analysis.face_analysis.emotion_scores)
          .map(([k, v]) => [k, Number(v.toFixed(2))])
      )
    },
    voice_analysis: {
      confidence: Number(analysis.voice_analysis.confidence.toFixed(2)),
      stress_level: Number(analysis.voice_analysis.stress_level.toFixed(2))
    }
  });

/**
 * @swagger
 * /api/analysis/detail:
 *   get:
 *     summary: 특정 분석 결과 상세 조회
 *     description: 분석 ID를 기반으로 특정 분석 결과의 상세 정보를 조회합니다.
 *     tags: [Analysis]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: 조회할 분석 결과의 ID
 *     responses:
 *       200:
 *         description: 분석 결과 조회 성공
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
 *                   $ref: '#/components/schemas/Analysis'
 *       400:
 *         description: 잘못된 요청
 *       401:
 *         description: 인증되지 않은 접근
 *       403:
 *         description: 권한 없음
 *       404:
 *         description: 분석 결과를 찾을 수 없음
 *       500:
 *         description: 서버 에러
 */

router.get(
  '/detail',
  auth(),
  [
    query('id').isMongoId().withMessage('Invalid analysis ID')
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

      const analysis = await Analysis.findById(req.query.id);
      
      if (!analysis) {
        return res.status(404).json(createResponse(
          false,
          'Analysis not found'
        ));
      }

      // 권한 검증: 자신의 분석 결과만 조회 가능
      if (analysis.userId.toString() !== req.user.user_id) {
        return res.status(403).json(createResponse(
          false,
          'Unauthorized access'
        ));
      }

      res.json(createResponse(
        true,
        'Analysis retrieved successfully',
        analysis
      ));
    } catch (error) {
      console.error('Analysis detail error:', error);
      res.status(500).json(createResponse(
        false,
        'Error fetching analysis detail',
        null,
        { error: error.message }
      ));
    }
  }
);

/**
 * @swagger
 * /api/analysis/current/{interview_count}:
 *   get:
 *     summary: 현재 인터뷰 회차의 감정 분석 데이터 조회
 *     description: 특정 인터뷰 회차의 개별 감정 분석 결과들과 평균 분석 결과를 조회합니다.
 *     tags: [Analysis]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: interview_count
 *         required: true
 *         schema:
 *           type: integer
 *         description: 조회할 인터뷰 회차 번호
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
 *                   type: object
 *                   properties:
 *                     summary:
 *                       type: object
 *                       properties:
 *                         total_analyses:
 *                           type: integer
 *                           description: 현재까지 완료된 분석 횟수
 *                         required_analyses:
 *                           type: integer
 *                           description: 필요한 총 분석 횟수
 *                           example: 6
 *                         status:
 *                           type: string
 *                           enum: [completed, in_progress]
 *                           description: 전체 분석 완료 여부
 *                         average_result:
 *                           type: object
 *                           nullable: true
 *                           properties:
 *                             face_confidence:
 *                               type: number
 *                               description: 평균 얼굴 분석 신뢰도
 *                             emotion_scores:
 *                               type: object
 *                               properties:
 *                                 angry:
 *                                   type: number
 *                                 disgust:
 *                                   type: number
 *                                 fear:
 *                                   type: number
 *                                 happy:
 *                                   type: number
 *                                 neutral:
 *                                   type: number
 *                                 sad:
 *                                   type: number
 *                                 surprise:
 *                                   type: number
 *                             date:
 *                               type: string
 *                               format: date
 *                               description: 평균 분석 날짜
 *                     analyses:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           analysis_id:
 *                             type: string
 *                             description: 개별 분석의 고유 ID
 *                           timestamp:
 *                             type: string
 *                             format: date-time
 *                             description: 분석 시간
 *                           face_analysis:
 *                             type: object
 *                             properties:
 *                               age:
 *                                 type: integer
 *                                 description: 추정 나이
 *                               dominant_emotion:
 *                                 type: string
 *                                 description: 주요 감정
 *                               dominant_gender:
 *                                 type: string
 *                                 description: 주요 성별
 *                               emotion:
 *                                 type: object
 *                                 properties:
 *                                   angry:
 *                                     type: number
 *                                   disgust:
 *                                     type: number
 *                                   fear:
 *                                     type: number
 *                                   happy:
 *                                     type: number
 *                                   neutral:
 *                                     type: number
 *                                   sad:
 *                                     type: number
 *                                   surprise:
 *                                     type: number
 *                               face_confidence:
 *                                 type: number
 *                               gender:
 *                                 type: object
 *                                 properties:
 *                                   Woman:
 *                                     type: number
 *                                   Man:
 *                                     type: number
 *                               region:
 *                                 type: object
 *                                 properties:
 *                                   x:
 *                                     type: number
 *                                   y:
 *                                     type: number
 *                                   w:
 *                                     type: number
 *                                   h:
 *                                     type: number
 *                                   left_eye:
 *                                     type: array
 *                                     items:
 *                                       type: number
 *                                   right_eye:
 *                                     type: array
 *                                     items:
 *                                       type: number
 *       400:
 *         description: 잘못된 요청
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: error
 *                 message:
 *                   type: string
 *       404:
 *         description: 분석 결과를 찾을 수 없음
 *       500:
 *         description: 서버 에러
 */
router.get(
    '/current/:interview_count',
    auth(),
    [validationRules.interviewCount],
    async (req, res) => {
      try {
        const interviewCount = parseInt(req.params.interview_count);
        
        // 개별 분석 결과들 조회
        const analyses = await Analysis.find({
            userId: new mongoose.Types.ObjectId(req.user.user_id),
            count: interviewCount
        })
        .sort({ serverTimestamp: -1 })
        .select('analysis_result serverTimestamp status');

        // 평균 분석 결과 조회
        const averageAnalysis = await EmotionAverage.findOne({
            count: interviewCount
        });

        if (!analyses.length) {
          return res.status(404).json(createResponse(
            false,
            'No analysis found for this interview count'
          ));
        }

        const response = {
          summary: {
            total_analyses: analyses.length,
            required_analyses: 6,
            status: analyses.length >= 6 ? 'completed' : 'in_progress',
            average_result: averageAnalysis ? {
              face_confidence: averageAnalysis.face_confidence,
              emotion_scores: averageAnalysis.emotion,
              date: averageAnalysis.date
            } : null
          },
          analyses: analyses.map(analysis => ({
            analysis_id: analysis._id,
            timestamp: analysis.serverTimestamp,
            face_analysis: analysis.analysis_result[0]
          }))
        };

        // 캐싱 설정 (5분)
        res.set('Cache-Control', 'private, max-age=300');

        res.json(createResponse(
          true,
          'Analysis data retrieved successfully',
          response
        ));

      } catch (error) {
        console.error('Analysis fetch error:', error);
        
        const errorMessage = error.name === 'CastError' 
          ? 'Invalid interview count format'
          : 'Failed to fetch analysis data';
        
        res.status(500).json(createResponse(
          false,
          errorMessage,
          null,
          { error: error.message }
        ));
      }
    }
);

/**
 * @swagger
 * /api/analysis/score:
 *   put:
 *     summary: 감정 분석 평균값에 최종 점수 추가
 *     description: 특정 회차의 감정 분석 평균값에 최종 점수를 추가합니다.
 *     tags: [Analysis]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - interview_count
 *               - final_score
 *             properties:
 *               interview_count:
 *                 type: integer
 *                 description: 인터뷰 회차
 *               final_score:
 *                 type: number
 *                 minimum: 0
 *                 maximum: 100
 *                 description: 최종 점수
 *     responses:
 *       200:
 *         description: 점수 업데이트 성공
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                 message:
 *                   type: string
 *                 data:
 *                   $ref: '#/components/schemas/Analysis'
 *       400:
 *         description: 잘못된 요청
 *       404:
 *         description: 분석 결과를 찾을 수 없음
 */
router.put(
  '/score',
  auth(),
  validateRequest([
    body('interview_count').isInt({ min: 1 }),
    body('final_score').isFloat({ min: 0, max: 100 })
  ]),
  async (req, res) => {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      const { interview_count, final_score } = req.body;

      const analysis = await Analysis.findOneAndUpdate(
        { 
          interview_count,
          user_id: new mongoose.Types.ObjectId(req.user.user_id)
        },
        { $set: { final_score } },
        { 
          new: true,
          session,
          runValidators: true
        }
      );

      if (!analysis) {
        await session.abortTransaction();
        return res.status(404).json(createResponse(
          false,
          'No analysis found for this interview count'
        ));
      }

      await session.commitTransaction();
      res.json(createResponse(
        true,
        'Score updated successfully',
        analysis
      ));
    } catch (error) {
      await session.abortTransaction();
      console.error('Score update error:', error);
      res.status(500).json(createResponse(
        false,
        'Failed to update score'
      ));
    } finally {
      session.endSession();
    }
  }
);

/**
 * @swagger
 * /api/analysis/history:
 *   get:
 *     summary: 기간별 분석 결과 조회
 *     description: 현재 로그인한 사용자의 특정 기간 동안의 분석 결과와 평균 분석 결과를 조회합니다.
 *     tags: [Analysis]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: startDate
 *         schema:
 *           type: string
 *           format: date
 *         description: 조회 시작 날짜 (YYYY-MM-DD)
 *       - in: query
 *         name: endDate
 *         schema:
 *           type: string
 *           format: date
 *         description: 조회 종료 날짜 (YYYY-MM-DD)
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           minimum: 1
 *           default: 1
 *         description: 페이지 번호
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 100
 *           default: 20
 *         description: 페이지당 항목 수
 *     responses:
 *       200:
 *         description: 기간별 분석 결과 조회 성공
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
 *                     period:
 *                       type: object
 *                       properties:
 *                         start:
 *                           type: string
 *                           format: date
 *                         end:
 *                           type: string
 *                           format: date
 *                     interview_results:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           count:
 *                             type: integer
 *                             description: 인터뷰 회차
 *                           status:
 *                             type: string
 *                             enum: [completed, in_progress]
 *                           progress:
 *                             type: object
 *                             properties:
 *                               total:
 *                                 type: integer
 *                               required:
 *                                 type: integer
 *                                 example: 6
 *                           average_analysis:
 *                             type: object
 *                             nullable: true
 *                             properties:
 *                               date:
 *                                 type: string
 *                                 format: date
 *                               face_confidence:
 *                                 type: number
 *                               emotion:
 *                                 type: object
 *                                 properties:
 *                                   angry:
 *                                     type: number
 *                                   disgust:
 *                                     type: number
 *                                   fear:
 *                                     type: number
 *                                   happy:
 *                                     type: number
 *                                   neutral:
 *                                     type: number
 *                                   sad:
 *                                     type: number
 *                                   surprise:
 *                                     type: number
 *                           individual_analyses:
 *                             type: array
 *                             items:
 *                               type: object
 *                               properties:
 *                                 timestamp:
 *                                   type: string
 *                                   format: date-time
 *                                 analysis:
 *                                   $ref: '#/components/schemas/Analysis'
 *                 meta:
 *                   type: object
 *                   properties:
 *                     pagination:
 *                       type: object
 *                       properties:
 *                         total:
 *                           type: number
 *                         page:
 *                           type: number
 *                         limit:
 *                           type: number
 *                         totalPages:
 *                           type: number
 *       400:
 *         description: 잘못된 요청 (날짜 형식 등)
 *       401:
 *         description: 인증되지 않은 접근
 *       500:
 *         description: 서버 에러
 */

router.get(
  '/history',
  auth(),
  [validationRules.dateRange],
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

      const { startDate, endDate } = req.query;
      const page = parseInt(req.query.page) || 1;
      const limit = parseInt(req.query.limit) || 20;
      const skip = (page - 1) * limit;
      
      // 쿼리 조건 구성
      const query = {
        userId: new mongoose.Types.ObjectId(req.user.user_id)
      };

      if (startDate || endDate) {
        query.serverTimestamp = {};
        if (startDate) query.serverTimestamp.$gte = new Date(startDate);
        if (endDate) query.serverTimestamp.$lte = new Date(endDate);
      }

      // 개별 분석 결과 조회
      const [analyses, total] = await Promise.all([
        Analysis.find(query)
          .sort({ count: -1, serverTimestamp: -1 })
          .skip(skip)
          .limit(limit),
        Analysis.countDocuments(query)
      ]);

      // 회차별로 그룹화
      const groupedAnalyses = {};
      analyses.forEach(analysis => {
        if (!groupedAnalyses[analysis.count]) {
          groupedAnalyses[analysis.count] = [];
        }
        groupedAnalyses[analysis.count].push(analysis);
      });

      // 평균 분석 결과 조회
      const counts = Object.keys(groupedAnalyses);
      const averageAnalyses = await EmotionAverage.find({
        count: { $in: counts.map(Number) }
      });

      // 응답 데이터 구성
      const interviewResults = await Promise.all(
        Object.entries(groupedAnalyses).map(async ([count, analyses]) => ({
          count: parseInt(count),
          status: analyses.length >= 6 ? 'completed' : 'in_progress',
          progress: {
            total: analyses.length,
            required: 6
          },
          average_analysis: averageAnalyses.find(avg => avg.count === parseInt(count)),
          individual_analyses: analyses.map(analysis => ({
            timestamp: analysis.serverTimestamp,
            analysis: analysis.analysis_result[0]
          }))
        }))
      );

      // 캐싱 설정 (5분)
      res.set('Cache-Control', 'private, max-age=300');

      res.json(createResponse(
        true,
        'Analysis history retrieved successfully',
        {
          period: {
            start: startDate || 'all',
            end: endDate || 'all'
          },
          interview_results: interviewResults
        },
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
      console.error('Period analysis error:', error);
      
      const errorMessage = error.name === 'CastError' 
        ? 'Invalid date format'
        : 'Error retrieving analysis history';
      
      res.status(500).json(createResponse(
        false,
        errorMessage,
        null,
        { error: error.message }
      ));
    }
  }
);

/**
 * @swagger
 * /api/analysis/statistics:
 *   get:
 *     summary: 사용자의 분석 결과 통계 조회
 *     description: 현재 로그인한 사용자의 전체 분석 결과에 대한 통계 정보와 회차별 평균 분석 결과를 조회합니다.
 *     tags: [Analysis]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: 통계 조회 성공
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
 *                     overview:
 *                       type: object
 *                       properties:
 *                         total_interviews:
 *                           type: integer
 *                           description: 총 인터뷰 회차 수
 *                         completed_interviews:
 *                           type: integer
 *                           description: 완료된 인터뷰 회차 수
 *                         total_analyses:
 *                           type: integer
 *                           description: 총 분석 횟수
 *                         average_confidence:
 *                           type: number
 *                           description: 전체 평균 신뢰도
 *                     emotion_trends:
 *                       type: array
 *                       description: 회차별 평균 감정 분석 결과
 *                       items:
 *                         type: object
 *                         properties:
 *                           count:
 *                             type: integer
 *                           date:
 *                             type: string
 *                             format: date
 *                           face_confidence:
 *                             type: number
 *                           emotion:
 *                             type: object
 *                             properties:
 *                               angry:
 *                                 type: number
 *                               disgust:
 *                                 type: number
 *                               fear:
 *                                 type: number
 *                               happy:
 *                                 type: number
 *                               neutral:
 *                                 type: number
 *                               sad:
 *                                 type: number
 *                               surprise:
 *                                 type: number
 *                     dominant_emotions:
 *                       type: object
 *                       description: 전체 기간 동안의 주요 감정 분포
 *                       properties:
 *                         happy:
 *                           type: number
 *                         neutral:
 *                           type: number
 *                         sad:
 *                           type: number
 *                         angry:
 *                           type: number
 *                         surprise:
 *                           type: number
 *                         fear:
 *                           type: number
 *                         disgust:
 *                           type: number
 *       401:
 *         description: 인증되지 않은 접근
 *       500:
 *         description: 서버 에러
 */

router.get(
  '/statistics',
  auth(),
  async (req, res) => {
    try {
      // 전체 분석 데이터 조회
      const analyses = await Analysis.find({
        userId: new mongoose.Types.ObjectId(req.user.user_id)
      });

      // 회차별 분석 수 계산
      const analysesByCount = {};
      analyses.forEach(analysis => {
        if (!analysesByCount[analysis.count]) {
          analysesByCount[analysis.count] = [];
        }
        analysesByCount[analysis.count].push(analysis);
      });

      // 완료된 회차 수 계산 (6개 이상의 분석이 있는 회차)
      const completedInterviews = Object.values(analysesByCount)
        .filter(analyses => analyses.length >= 6).length;

      // 전체 평균 신뢰도 계산
      const totalConfidence = analyses.reduce((sum, analysis) => 
        sum + analysis.analysis_result[0].face_confidence, 0);
      const averageConfidence = analyses.length ? 
        Number((totalConfidence / analyses.length).toFixed(2)) : 0;

      // 회차별 평균 감정 분석 결과 조회
      const emotionAverages = await EmotionAverage.find({
        count: { $in: Object.keys(analysesByCount).map(Number) }
      }).sort({ count: 1 });

      // 전체 기간 동안의 주요 감정 분포 계산
      const totalEmotions = {
        angry: 0, disgust: 0, fear: 0, happy: 0,
        neutral: 0, sad: 0, surprise: 0
      };

      emotionAverages.forEach(avg => {
        Object.keys(totalEmotions).forEach(emotion => {
          totalEmotions[emotion] += avg.emotion[emotion];
        });
      });

      // 감정 분포 백분율 계산
      const emotionCount = emotionAverages.length;
      const dominantEmotions = Object.fromEntries(
        Object.entries(totalEmotions).map(([emotion, total]) => [
          emotion,
          Number((total / emotionCount).toFixed(2))
        ])
      );

      // 캐싱 설정 (5분)
      res.set('Cache-Control', 'private, max-age=300');

      res.json(createResponse(
        true,
        'Statistics retrieved successfully',
        {
          overview: {
            total_interviews: Object.keys(analysesByCount).length,
            completed_interviews: completedInterviews,
            total_analyses: analyses.length,
            average_confidence: averageConfidence
          },
          emotion_trends: emotionAverages,
          dominant_emotions: dominantEmotions
        }
      ));
    } catch (error) {
      console.error('Statistics error:', error);
      
      res.status(500).json(createResponse(
        false,
        'Error calculating statistics',
        null,
        { error: error.message }
      ));
    }
  }
);

/**
 * @swagger
 * /api/analysis/update-score:
 *   put:
 *     summary: 분석 결과에 최종 점수 추가
 *     description: 특정 분석 결과에 최종 점수와 감정 점수를 추가합니다.
 *     tags: [Analysis]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - analysisId
 *               - final_score
 *             properties:
 *               analysisId:
 *                 type: string
 *                 description: 수정할 분석 결과의 ID
 *               final_score:
 *                 type: number
 *                 minimum: 0
 *                 maximum: 100
 *                 description: 최종 점수 (0-100)
 *               emotion_scores:
 *                 type: object
 *                 description: 감정별 점수 (선택적)
 *                 properties:
 *                   angry:
 *                     type: number
 *                     minimum: 0
 *                     maximum: 100
 *                   disgust:
 *                     type: number
 *                     minimum: 0
 *                     maximum: 100
 *                   fear:
 *                     type: number
 *                     minimum: 0
 *                     maximum: 100
 *                   happy:
 *                     type: number
 *                     minimum: 0
 *                     maximum: 100
 *                   neutral:
 *                     type: number
 *                     minimum: 0
 *                     maximum: 100
 *                   sad:
 *                     type: number
 *                     minimum: 0
 *                     maximum: 100
 *                   surprise:
 *                     type: number
 *                     minimum: 0
 *                     maximum: 100
 *     responses:
 *       200:
 *         description: 점수 업데이트 성공
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
 *                   $ref: '#/components/schemas/Analysis'
 *       400:
 *         description: 잘못된 요청
 *       401:
 *         description: 인증되지 않은 접근
 *       403:
 *         description: 권한 없음
 *       404:
 *         description: 분석 결과를 찾을 수 없음
 *       500:
 *         description: 서버 에러
 */

router.put(
  '/update-score',
  auth(),
  [
    body('analysisId').isMongoId().withMessage('Invalid analysis ID'),
    body('final_score').isFloat({ min: 0, max: 100 }).withMessage('Score must be between 0 and 100'),
    body('emotion_scores').optional().isObject()
      .custom((scores) => {
        if (scores) {
          const validEmotions = ['angry', 'disgust', 'fear', 'happy', 'neutral', 'sad', 'surprise'];
          const emotions = Object.keys(scores);
          return emotions.every(emotion => 
            validEmotions.includes(emotion) && 
            typeof scores[emotion] === 'number' && 
            scores[emotion] >= 0 && 
            scores[emotion] <= 100
          );
        }
        return true;
      }).withMessage('Invalid emotion scores format or values')
  ],
  async (req, res) => {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        await session.abortTransaction();
        return res.status(400).json(createResponse(
          false,
          'Validation failed',
          null,
          { errors: errors.array() }
        ));
      }

      const { analysisId, final_score, emotion_scores } = req.body;

      const analysis = await Analysis.findById(analysisId)
        .session(session);

      if (!analysis) {
        await session.abortTransaction();
        return res.status(404).json(createResponse(
          false,
          'Analysis not found'
        ));
      }

      // 권한 검증: 자신의 분석 결과만 수정 가능
      if (analysis.userId.toString() !== req.user.user_id) {
        await session.abortTransaction();
        return res.status(403).json(createResponse(
          false,
          'Unauthorized access'
        ));
      }

      // 데이터 업데이트
      if (emotion_scores) {
        analysis.analysis_result[0].emotion = emotion_scores;
      }
      analysis.result = { final_score };
      
      await analysis.save({ session });
      await session.commitTransaction();

      res.json(createResponse(
        true,
        'Score updated successfully',
        analysis
      ));
    } catch (error) {
      await session.abortTransaction();
      console.error('Score update error:', error);
      
      const errorMessage = error.name === 'CastError' 
        ? 'Invalid ID format'
        : 'Failed to update score';
      
      res.status(500).json(createResponse(
        false,
        errorMessage,
        null,
        { error: error.message }
      ));
    } finally {
      session.endSession();
    }
  }
);

/**
 * @swagger
 * /api/analysis/combined:
 *   get:
 *     summary: 회차별 종합 데이터 조회
 *     description: 특정 회차의 인터뷰 데이터, 개별 분석 결과, 평균 분석 결과를 모두 조회합니다.
 *     tags: [Analysis]
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
 *                   type: object
 *                   properties:
 *                     interview_data:
 *                       type: object
 *                       nullable: true
 *                       properties:
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
 *                     emotion_analysis:
 *                       type: object
 *                       properties:
 *                         summary:
 *                           type: object
 *                           properties:
 *                             total_analyses:
 *                               type: integer
 *                             status:
 *                               type: string
 *                               enum: [completed, in_progress]
 *                             average_result:
 *                               type: object
 *                               nullable: true
 *                               properties:
 *                                 face_confidence:
 *                                   type: number
 *                                 emotion:
 *                                   type: object
 *                                   properties:
 *                                     angry:
 *                                       type: number
 *                                     disgust:
 *                                       type: number
 *                                     fear:
 *                                       type: number
 *                                     happy:
 *                                       type: number
 *                                     neutral:
 *                                       type: number
 *                                     sad:
 *                                       type: number
 *                                     surprise:
 *                                       type: number
 *                         individual_results:
 *                           type: array
 *                           items:
 *                             type: object
 *                             properties:
 *                               timestamp:
 *                                 type: string
 *                                 format: date-time
 *                               analysis:
 *                                 $ref: '#/components/schemas/Analysis'
 *       400:
 *         description: 잘못된 요청
 *       401:
 *         description: 인증되지 않은 접근
 *       404:
 *         description: 데이터를 찾을 수 없음
 *       500:
 *         description: 서버 에러
 */

router.get(
  '/combined',
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

          const count = parseInt(req.query.count);
          const userId = req.user.user_id;
          
          // 병렬로 모든 데이터 조회
          const [interview, analyses, averageAnalysis] = await Promise.all([
              Interview.findOne({
                  user_id: new mongoose.Types.ObjectId(userId),
                  interview_count: count
              }),
              Analysis.find({
                  userId: new mongoose.Types.ObjectId(userId),
                  count: count
              }).sort({ serverTimestamp: -1 }),
              EmotionAverage.findOne({ count: count })
          ]);

          // 데이터가 없는 경우 처리
          if (!interview && !analyses.length) {
              return res.status(404).json(createResponse(
                  false,
                  'No data found for this interview count'
              ));
          }

          const response = {
              interview_data: interview ? {
                  questions_answers: interview.questions_answers,
                  score: interview.score,
                  createdAt: interview.createdAt
              } : null,
              emotion_analysis: {
                  summary: {
                      total_analyses: analyses.length,
                      status: analyses.length >= 6 ? 'completed' : 'in_progress',
                      average_result: averageAnalysis
                  },
                  individual_results: analyses.map(a => ({
                      timestamp: a.serverTimestamp,
                      analysis: a.analysis_result[0]
                  }))
              }
          };

          // 캐싱 설정 (5분)
          res.set('Cache-Control', 'private, max-age=300');

          res.json(createResponse(
              true,
              'Combined data retrieved successfully',
              response
          ));
      } catch (error) {
          console.error('Combined data fetch error:', error);
          
          const errorMessage = error.name === 'CastError' 
              ? 'Invalid interview count format'
              : 'Error retrieving combined data';
          
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