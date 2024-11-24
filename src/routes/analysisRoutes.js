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
* /api/analysis/current/{interview_count}:
*   get:
*     summary: 현재 인터뷰 회차의 감정 분석 평균값 조회
*     description: 특정 인터뷰 회차의 얼굴 분석 평균 결과를 조회합니다.
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
*                 count:
*                   type: integer
*                 date:
*                   type: string
*                 face_confidence:
*                   type: number
*                 emotion:
*                   type: object
*                   properties:
*                     angry:
*                       type: number
*                     disgust:
*                       type: number
*                     fear:
*                       type: number
*                     happy:
*                       type: number
*                     neutral:
*                       type: number
*                     sad:
*                       type: number
*                     surprise:
*                       type: number
*       404:
*         description: 분석 결과를 찾을 수 없음
*/
router.get('/current/:interview_count', auth, async (req, res) => {
  try {
    const interviewCount = parseInt(req.params.interview_count);
    
    // MongoDB의 emotion_averages 컬렉션에서 조회
    const db = mongoose.connection.db;
    const emotionAverage = await db.collection('emotion_averages')
      .findOne({ 
        count: interviewCount,
        user_id: new mongoose.Types.ObjectId(req.user.user_id)
      });
 
    if (!emotionAverage) {
      return res.status(404).json({ 
        error: 'No emotion analysis average found for this interview count' 
      });
    }
 
    res.json(emotionAverage);
  } catch (error) {
    console.error('Emotion average fetch error:', error);
    res.status(500).json({ error: 'Failed to fetch emotion average' });
  }
 });
 
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
 *                 message:
 *                   type: string
 *                   example: Score updated successfully
 *                 analysis:
 *                   type: object
 *       400:
 *         description: 잘못된 요청
 *       404:
 *         description: 분석 결과를 찾을 수 없음
 */
 router.put('/score', auth, async (req, res) => {
  try {
    const { interview_count, final_score } = req.body;
    
    // 입력값 검증
    if (!interview_count || typeof interview_count !== 'number') {
      return res.status(400).json({ 
        error: 'Valid interview count is required' 
      });
    }
 
    if (typeof final_score !== 'number' || final_score < 0 || final_score > 100) {
      return res.status(400).json({ 
        error: 'Final score must be a number between 0 and 100' 
      });
    }
 
    const db = mongoose.connection.db;
    
    // emotion_averages 컬렉션에서 해당 회차의 분석 결과 찾기
    const updatedAnalysis = await db.collection('emotion_averages')
      .findOneAndUpdate(
        { 
          count: interview_count,
          user_id: new mongoose.Types.ObjectId(req.user.user_id)
        },
        { $set: { final_score: final_score } },
        { returnDocument: 'after' }
      );
 
    if (!updatedAnalysis.value) {
      return res.status(404).json({ 
        error: 'No analysis found for this interview count' 
      });
    }
 
    res.json({
      message: 'Score updated successfully',
      analysis: updatedAnalysis.value
    });
  } catch (error) {
    console.error('Score update error:', error);
    res.status(500).json({ error: 'Failed to update score' });
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

/**
 * @swagger
 * /api/analysis/{analysis_id}/score:
 *   put:
 *     summary: 분석 결과에 최종 점수 추가
 *     description: 특정 분석 결과에 최종 평균 점수를 추가합니다.
 *     tags: [Analysis]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: analysis_id
 *         required: true
 *         schema:
 *           type: string
 *         description: 업데이트할 분석 결과의 ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - final_score
 *               - emotion_scores
 *             properties:
 *               final_score:
 *                 type: number
 *                 description: 최종 평균 점수
 *               emotion_scores:
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
 *                   sad:
 *                     type: number
 *                   surprise:
 *                     type: number
 *                   neutral:
 *                     type: number
 *     responses:
 *       200:
 *         description: 점수 업데이트 성공
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: Score updated successfully
 *                 analysis:
 *                   $ref: '#/components/schemas/Analysis'
 *       400:
 *         description: 잘못된 요청
 *       401:
 *         description: 인증 실패
 *       404:
 *         description: 분석 결과를 찾을 수 없음
 */
router.put('/:analysis_id/score', auth, async (req, res) => {
  try {
    const { final_score, emotion_scores } = req.body;
    
    // 입력값 검증
    if (typeof final_score !== 'number' || final_score < 0 || final_score > 100) {
      return res.status(400).json({ 
        error: 'Final score must be a number between 0 and 100' 
      });
    }

    // 분석 결과 찾기
    const analysis = await Analysis.findById(req.params.analysis_id);
    if (!analysis) {
      return res.status(404).json({ error: 'Analysis not found' });
    }

    // 권한 확인
    if (analysis.user_id.toString() !== req.user.user_id) {
      return res.status(403).json({ error: 'Unauthorized access' });
    }

    // 결과 업데이트
    analysis.result.final_score = final_score;
    if (emotion_scores) {
      analysis.face_analysis.emotion_scores = emotion_scores;
    }
    
    await analysis.save();

    res.json({
      message: 'Score updated successfully',
      analysis
    });
  } catch (error) {
    console.error('Score update error:', error);
    res.status(500).json({ error: 'Failed to update score' });
  }
});

module.exports = router;