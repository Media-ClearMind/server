const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const Interview = require('../models/interview');
const User = require('../models/user');

/**
 * @swagger
 * /api/interviews/submit:
 *   post:
 *     summary: 인터뷰 결과 제출 (3개의 Q&A 세트와 점수)
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
 *             properties:
 *               questions_answers:
 *                 type: array
 *                 description: 3개의 질문-답변 세트
 *                 items:
 *                   type: object
 *                   required:
 *                     - question
 *                     - answer
 *                     - order
 *                   properties:
 *                     question:
 *                       type: string
 *                       example: "첫 번째 질문입니다."
 *                     answer:
 *                       type: string
 *                       example: "첫 번째 답변입니다."
 *                     order:
 *                       type: number
 *                       example: 1
 *               score:
 *                 type: number
 *                 description: 인터뷰 점수 (0-100)
 *                 minimum: 0
 *                 maximum: 100
 *                 example: 85
 *           example:
 *             questions_answers:
 *               - question: "첫 번째 질문입니다."
 *                 answer: "첫 번째 답변입니다."
 *                 order: 1
 *               - question: "두 번째 질문입니다."
 *                 answer: "두 번째 답변입니다."
 *                 order: 2
 *               - question: "세 번째 질문입니다."
 *                 answer: "세 번째 답변입니다."
 *                 order: 3
 *             score: 85
 */
router.post('/submit', auth, async (req, res) => {
    try {
      const { score } = req.body;
      
      // score 유효성 검사
      if (score < 0 || score > 100 || !Number.isInteger(score)) {
        return res.status(400).json({ 
          error: 'Score must be an integer between 0 and 100' 
        });
      }
  
      // 사용자의 count 증가
      const user = await User.findByIdAndUpdate(
        req.user.user_id,
        { $inc: { count: 1 } },
        { new: true }
      );
  
      // 새 인터뷰 데이터 생성
      const interview = new Interview({
        user_id: req.user.user_id,
        interview_count: user.count,
        questions_answers: req.body.questions_answers,
        score: score
      });
  
      await interview.save();
  
      res.status(201).json({ 
        message: 'Interview submitted successfully',
        interview_count: user.count,
        score: score
      });
    } catch (error) {
      console.error('Interview submission error:', error);
      res.status(500).json({ error: 'Failed to submit interview' });
    }
  });

/**
 * @swagger
 * /api/interviews/history:
 *   get:
 *     summary: 사용자의 모든 인터뷰 히스토리 조회
 *     description: 사용자가 수행한 모든 인터뷰 기록을 최신순으로 조회합니다.
 *     tags: [Interviews]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: 성공
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: object
 *                 properties:
 *                   user_id:
 *                     type: string
 *                     description: 사용자 ID
 *                   interview_count:
 *                     type: number
 *                     description: 인터뷰 회차
 *                   questions_answers:
 *                     type: array
 *                     description: 질문-답변 세트 목록
 *                     items:
 *                       type: object
 *                       properties:
 *                         question:
 *                           type: string
 *                           description: 질문 내용
 *                         answer:
 *                           type: string
 *                           description: 답변 내용
 *                         order:
 *                           type: number
 *                           description: 질문 순서
 *                   createdAt:
 *                     type: string
 *                     format: date-time
 *                     description: 인터뷰 수행 시간
 */
router.get('/history', auth, async (req, res) => {
  try {
    const interviews = await Interview.find({ user_id: req.user.user_id })
      .sort({ createdAt: -1 });

    res.json(interviews);
  } catch (error) {
    console.error('Interview history fetch error:', error);
    res.status(500).json({ error: 'Failed to fetch interview history' });
  }
});

/**
 * @swagger
 * /api/interviews/{interview_count}:
 *   get:
 *     summary: 특정 회차의 인터뷰 상세 조회
 *     description: 사용자의 특정 회차 인터뷰 내용을 상세 조회합니다.
 *     tags: [Interviews]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: interview_count
 *         required: true
 *         schema:
 *           type: integer
 *         description: 조회할 인터뷰의 회차 번호
 *         example: 1
 *     responses:
 *       200:
 *         description: 성공
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 user_id:
 *                   type: string
 *                   description: 사용자 ID
 *                 interview_count:
 *                   type: number
 *                   description: 인터뷰 회차
 *                 questions_answers:
 *                   type: array
 *                   description: 질문-답변 세트 목록
 *                   items:
 *                     type: object
 *                     properties:
 *                       question:
 *                         type: string
 *                         example: "첫 번째 질문입니다."
 *                       answer:
 *                         type: string
 *                         example: "첫 번째 답변입니다."
 *                       order:
 *                         type: number
 *                         example: 1
 *                 createdAt:
 *                   type: string
 *                   format: date-time
 *                   description: 인터뷰 수행 시간
 *       404:
 *         description: 인터뷰를 찾을 수 없음
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: Interview not found
 */
router.get('/:interview_count', auth, async (req, res) => {
  try {
    const interview = await Interview.findOne({
      user_id: req.user.user_id,
      interview_count: req.params.interview_count
    });

    if (!interview) {
      return res.status(404).json({ error: 'Interview not found' });
    }

    res.json(interview);
  } catch (error) {
    console.error('Interview fetch error:', error);
    res.status(500).json({ error: 'Failed to fetch interview' });
  }
});

module.exports = router;