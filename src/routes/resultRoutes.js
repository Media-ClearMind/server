const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const { param, query, validationResult } = require('express-validator');
const auth = require('../middleware/auth');
const Result = require('../models/result');

// 표준화된 응답 생성 헬퍼 함수
const createResponse = (success, message, data = null, meta = null) => ({
  status: success ? 'success' : 'error',
  message,
  data,
  meta
});

/**
 * @swagger
 * tags:
 *   - name: Results
 *     description: 인터뷰 및 감정 분석 결과 관리
 * 
 * /api/result/{count}:
 *   get:
 *     summary: 특정 회차 결과 조회
 *     description: 특정 회차의 인터뷰 결과와 감정 분석 평균을 조회합니다.
 *     tags: [Results]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
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
 *                   example: Result retrieved successfully
 *                 data:
 *                   type: object
 *                   properties:
 *                     interview_count:
 *                       type: integer
 *                       example: 1
 *                     date:
 *                       type: string
 *                       example: "2024-03-12"
 *                     interview_data:
 *                       type: object
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
 *                               score:
 *                                 type: number
 *                               order:
 *                                 type: integer
 *                         mean_score:
 *                           type: number
 *                     analysis_average:
 *                       type: object
 *                       properties:
 *                         face_confidence:
 *                           type: number
 *                         emotion:
 *                           type: object
 *                           properties:
 *                             angry:
 *                               type: number
 *                             disgust:
 *                               type: number
 *                             fear:
 *                               type: number
 *                             happy:
 *                               type: number
 *                             neutral:
 *                               type: number
 *                             sad:
 *                               type: number
 *                             surprise:
 *                               type: number
 *                         total_analyses:
 *                           type: integer
 *       404:
 *         description: 해당 회차의 결과를 찾을 수 없음
 */
router.get('/:count', 
  auth(),
  [param('count').isInt({ min: 1 })],
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

      const result = await Result.findOne({
        user_id: req.user.user_id,
        interview_count: parseInt(req.params.count)
      }).select('-__v');

      if (!result) {
        return res.status(404).json(createResponse(
          false,
          'Result not found for this interview count'
        ));
      }

      res.json(createResponse(true, 'Result retrieved successfully', result));
    } catch (error) {
      console.error('Result fetch error:', error);
      res.status(500).json(createResponse(false, 'Failed to fetch result'));
    }
  }
);

/**
 * @swagger
 * /api/result/period/{startDate}/{endDate}:
 *   get:
 *     summary: 기간별 결과 조회
 *     description: 지정된 기간 내의 모든 인터뷰 결과를 조회합니다. 날짜를 all로 지정하면 전체 기간을 조회합니다.
 *     tags: [Results]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: startDate
 *         required: true
 *         schema:
 *           type: string
 *         description: 시작 날짜 (YYYY-MM-DD) 또는 'all'
 *       - in: path
 *         name: endDate
 *         required: true
 *         schema:
 *           type: string
 *         description: 종료 날짜 (YYYY-MM-DD) 또는 'all'
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
 *                   example: Results retrieved successfully
 *                 data:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       interview_count:
 *                         type: integer
 *                       date:
 *                         type: string
 *                       interview_data:
 *                         type: object
 *                         properties:
 *                           questions_answers:
 *                             type: array
 *                             items:
 *                               type: object
 *                               properties:
 *                                 question:
 *                                   type: string
 *                                 answer:
 *                                   type: string
 *                                 score:
 *                                   type: number
 *                                 order:
 *                                   type: integer
 *                           mean_score:
 *                             type: number
 *                       analysis_average:
 *                         type: object
 *                         properties:
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
 *                           total_analyses:
 *                             type: integer
 *                 meta:
 *                   type: object
 *                   properties:
 *                     total:
 *                       type: integer
 *                     page:
 *                       type: integer
 *                     limit:
 *                       type: integer
 *                     totalPages:
 *                       type: integer
 */
router.get('/period/:startDate/:endDate',
  auth(),
  [
    param('startDate').isString(),
    param('endDate').isString(),
    query('page').optional().isInt({ min: 1 }),
    query('limit').optional().isInt({ min: 1, max: 100 })
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

      const page = parseInt(req.query.page) || 1;
      const limit = parseInt(req.query.limit) || 20;
      const skip = (page - 1) * limit;

      let dateQuery = { user_id: req.user.user_id };
      
      // 날짜 필터 적용 (all이 아닌 경우)
      if (req.params.startDate !== 'all' && req.params.endDate !== 'all') {
        dateQuery.date = {
          $gte: req.params.startDate,
          $lte: req.params.endDate
        };
      }

      // 결과 조회 및 총 개수 계산을 동시에 실행
      const [results, total] = await Promise.all([
        Result.find(dateQuery)
          .sort({ interview_count: -1 })
          .skip(skip)
          .limit(limit)
          .select('-__v'),
        Result.countDocuments(dateQuery)
      ]);

      // 캐싱 설정 (5분)
      res.set('Cache-Control', 'private, max-age=300');

      res.json(createResponse(
        true,
        'Results retrieved successfully',
        results,
        {
          total,
          page,
          limit,
          totalPages: Math.ceil(total / limit)
        }
      ));
    } catch (error) {
      console.error('Results fetch error:', error);
      res.status(500).json(createResponse(false, 'Failed to fetch results'));
    }
  }
);

module.exports = router;