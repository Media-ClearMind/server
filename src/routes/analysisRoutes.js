const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const Analysis = require('../models/analysis');

/**
 * @swagger
 * components:
 *   schemas:
 *     Analysis:
 *       type: object
 *       properties:
 *         _id:
 *           type: string
 *           description: 분석 결과 ID
 *         user_id:
 *           type: string
 *           description: 사용자 ID
 *         createdAt:
 *           type: string
 *           format: date-time
 *         face_analysis:
 *           type: object
 *           properties:
 *             score:
 *               type: number
 *               description: 얼굴 분석 점수
 *             emotion:
 *               type: string
 *               description: 감지된 감정
 *         voice_analysis:
 *           type: object
 *           properties:
 *             confidence:
 *               type: number
 *               description: 음성 분석 신뢰도
 *             stress_level:
 *               type: number
 *               description: 스트레스 레벨
 *         result:
 *           type: object
 *           properties:
 *             summary:
 *               type: string
 *               description: 분석 결과 요약
 */

/**
 * @swagger
 * /api/analysis/detail/{analysis_id}:
 *   get:
 *     summary: 특정 분석 결과 상세 조회
 *     tags: [Analysis]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: analysis_id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: 분석 결과 조회 성공
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Analysis'
 *       403:
 *         description: 권한 없음
 *       404:
 *         description: 분석 결과를 찾을 수 없음
 */
router.get('/detail/:analysis_id', auth, async (req, res) => {
  try {
    const analysis = await Analysis.findById(req.params.analysis_id);
    
    if (!analysis) {
      return res.status(404).json({ error: 'Analysis not found' });
    }

    if (analysis.user_id.toString() !== req.user.user_id) {
      return res.status(403).json({ error: 'Unauthorized access' });
    }

    res.json(analysis);
  } catch (error) {
    console.error('Analysis detail error:', error);
    res.status(500).json({ error: 'Error fetching analysis detail' });
  }
});

/**
 * @swagger
 * /api/analysis/user/{user_id}/history/period:
 *   get:
 *     summary: 기간별 분석 결과 조회
 *     tags: [Analysis]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: user_id
 *         required: true
 *         schema:
 *           type: string
 *       - in: query
 *         name: startDate
 *         schema:
 *           type: string
 *           format: date
 *       - in: query
 *         name: endDate
 *         schema:
 *           type: string
 *           format: date
 *     responses:
 *       200:
 *         description: 기간별 분석 결과 조회 성공
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 user_id:
 *                   type: string
 *                 period:
 *                   type: object
 *                   properties:
 *                     start:
 *                       type: string
 *                     end:
 *                       type: string
 *                 total_count:
 *                   type: number
 *                 analysis_history:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       analysis_id:
 *                         type: string
 *                       date:
 *                         type: string
 *                         format: date-time
 *                       summary:
 *                         type: string
 *                       face_score:
 *                         type: number
 *                       voice_confidence:
 *                         type: number
 *                       stress_level:
 *                         type: number
 */
router.get('/user/:user_id/history/period', auth, async (req, res) => {
  try {
    if (req.user.user_id !== req.params.user_id) {
      return res.status(403).json({ error: 'Unauthorized access' });
    }

    const { startDate, endDate } = req.query;
    
    const query = {
      user_id: req.params.user_id,
      createdAt: {}
    };

    if (startDate) {
      query.createdAt.$gte = new Date(startDate);
    }
    if (endDate) {
      query.createdAt.$lte = new Date(endDate);
    }

    const analysisHistory = await Analysis.find(query)
      .sort({ createdAt: -1 })
      .select('createdAt result.summary face_analysis.score voice_analysis');

    const formattedHistory = analysisHistory.map(analysis => ({
      analysis_id: analysis._id,
      date: analysis.createdAt,
      summary: analysis.result.summary,
      face_score: analysis.face_analysis.score,
      voice_confidence: analysis.voice_analysis.confidence,
      stress_level: analysis.voice_analysis.stress_level
    }));

    res.json({
      user_id: req.params.user_id,
      period: {
        start: startDate || 'all',
        end: endDate || 'all'
      },
      total_count: formattedHistory.length,
      analysis_history: formattedHistory
    });
  } catch (error) {
    console.error('Period analysis error:', error);
    res.status(400).json({ error: 'Invalid date format or other error' });
  }
});

/**
 * @swagger
 * /api/analysis/user/{user_id}/statistics:
 *   get:
 *     summary: 분석 결과 통계 조회
 *     tags: [Analysis]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: user_id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: 통계 조회 성공
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 total_analyses:
 *                   type: number
 *                   description: 전체 분석 횟수
 *                 average_scores:
 *                   type: object
 *                   properties:
 *                     face:
 *                       type: number
 *                       description: 평균 얼굴 분석 점수
 *                     voice_confidence:
 *                       type: number
 *                       description: 평균 음성 신뢰도
 *                     stress_level:
 *                       type: number
 *                       description: 평균 스트레스 레벨
 *                 emotion_distribution:
 *                   type: object
 *                   description: 감정별 분포 횟수
 *                 trending:
 *                   type: object
 *                   properties:
 *                     face_score:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           date:
 *                             type: string
 *                             format: date-time
 *                           score:
 *                             type: number
 *                     stress_level:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           date:
 *                             type: string
 *                             format: date-time
 *                           level:
 *                             type: number
 */
router.get('/user/:user_id/statistics', auth, async (req, res) => {
  try {
    if (req.user.user_id !== req.params.user_id) {
      return res.status(403).json({ error: 'Unauthorized access' });
    }

    const analyses = await Analysis.find({ user_id: req.params.user_id });
    
    const statistics = {
      total_analyses: analyses.length,
      average_scores: {
        face: 0,
        voice_confidence: 0,
        stress_level: 0
      },
      emotion_distribution: {},
      trending: {
        face_score: [],
        stress_level: []
      }
    };

    if (analyses.length > 0) {
      statistics.average_scores.face = analyses.reduce((sum, analysis) => 
        sum + analysis.face_analysis.score, 0) / analyses.length;
      
      statistics.average_scores.voice_confidence = analyses.reduce((sum, analysis) => 
        sum + analysis.voice_analysis.confidence, 0) / analyses.length;
      
      statistics.average_scores.stress_level = analyses.reduce((sum, analysis) => 
        sum + analysis.voice_analysis.stress_level, 0) / analyses.length;

      analyses.forEach(analysis => {
        const emotion = analysis.face_analysis.emotion;
        statistics.emotion_distribution[emotion] = (statistics.emotion_distribution[emotion] || 0) + 1;
      });

      const recent = analyses.slice(-5).reverse();
      statistics.trending.face_score = recent.map(a => ({
        date: a.createdAt,
        score: a.face_analysis.score
      }));
      
      statistics.trending.stress_level = recent.map(a => ({
        date: a.createdAt,
        level: a.voice_analysis.stress_level
      }));
    }

    res.json(statistics);
  } catch (error) {
    console.error('Statistics error:', error);
    res.status(500).json({ error: 'Error calculating statistics' });
  }
});

module.exports = router;