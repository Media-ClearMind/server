const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const Interview = require('../models/interview');
const User = require('../models/user');

/**
 * @swagger
 * /api/interviews/submit:
 *   post:
 *     summary: 인터뷰 결과 제출
 *     tags: [Interviews]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               questions_answers:
 *                 type: array
 *                 items:
 *                   type: object
 *                   properties:
 *                     question:
 *                       type: string
 *                     answer:
 *                       type: string
 *                     order:
 *                       type: number
 *     responses:
 *       201:
 *         description: 인터뷰 제출 성공
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: Interview submitted successfully
 *                 interview_count:
 *                   type: number
 *                   example: 1
 */
router.post('/submit', auth, async (req, res) => {
  try {
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
      questions_answers: req.body.questions_answers
    });

    await interview.save();

    res.status(201).json({ 
      message: 'Interview submitted successfully',
      interview_count: user.count
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
 *     summary: 사용자의 인터뷰 히스토리 조회
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
 *                   interview_count:
 *                     type: number
 *                   questions_answers:
 *                     type: array
 *                     items:
 *                       type: object
 *                       properties:
 *                         question:
 *                           type: string
 *                         answer:
 *                           type: string
 *                         order:
 *                           type: number
 *                   createdAt:
 *                     type: string
 *                     format: date-time
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
 *                 interview_count:
 *                   type: number
 *                 questions_answers:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       question:
 *                         type: string
 *                       answer:
 *                         type: string
 *                       order:
 *                         type: number
 *                 createdAt:
 *                   type: string
 *                   format: date-time
 *       404:
 *         description: 인터뷰를 찾을 수 없음
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