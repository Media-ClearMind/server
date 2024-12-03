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

// 유효성 검증 미들웨어
const validateRequest = (validations) => {
  return async (req, res, next) => {
    await Promise.all(validations.map(validation => validation.run(req)));
    
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

// 단일 회차 조회
router.get('/:count',
  auth(),
  validateRequest([
    param('count').isInt({ min: 1 })
      .withMessage('Interview count must be a positive integer')
  ]),
  async (req, res) => {
    try {
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

// 결과 목록 조회 (전체 또는 기간별)
router.get('/', 
  auth(),
  validateRequest([
    query('startDate').optional().isDate()
      .withMessage('Start date must be in YYYY-MM-DD format'),
    query('endDate').optional().isDate()
      .withMessage('End date must be in YYYY-MM-DD format'),
    query('page').optional().isInt({ min: 1 })
      .withMessage('Page must be a positive integer'),
    query('limit').optional().isInt({ min: 1, max: 100 })
      .withMessage('Limit must be between 1 and 100'),
    query('sort').optional().isIn(['asc', 'desc'])
      .withMessage('Sort must be either asc or desc')
  ]),
  async (req, res) => {
    try {
      const {
        startDate,
        endDate,
        page = 1,
        limit = 20,
        sort = 'desc'
      } = req.query;

      const query = { user_id: req.user.user_id };
      
      // 날짜 필터 적용 (있는 경우에만)
      if (startDate && endDate) {
        query.date = {
          $gte: startDate,
          $lte: endDate
        };
      }

      const options = {
        sort: { interview_count: sort === 'desc' ? -1 : 1 },
        skip: (page - 1) * limit,
        limit: parseInt(limit),
        select: '-__v'
      };

      // 결과 조회 및 총 개수 계산을 동시에 실행
      const [results, total] = await Promise.all([
        Result.find(query, null, options),
        Result.countDocuments(query)
      ]);

      // 캐싱 설정 (5분)
      res.set('Cache-Control', 'private, max-age=300');

      res.json(createResponse(
        true,
        'Results retrieved successfully',
        results,
        {
          total,
          page: parseInt(page),
          limit: parseInt(limit),
          totalPages: Math.ceil(total / parseInt(limit))
        }
      ));
    } catch (error) {
      console.error('Results fetch error:', error);
      res.status(500).json(createResponse(false, 'Failed to fetch results'));
    }
  }
);

module.exports = router;