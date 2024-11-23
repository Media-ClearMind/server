const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const Analysis = require('../models/analysis');

// 기존 라우트들...

// 특정 분석 결과 상세 조회
router.get('/detail/:analysis_id', auth, async (req, res) => {
  try {
    const analysis = await Analysis.findById(req.params.analysis_id);
    
    if (!analysis) {
      return res.status(404).json({ error: 'Analysis not found' });
    }

    // 본인의 분석 결과만 조회 가능
    if (analysis.user_id.toString() !== req.user.user_id) {
      return res.status(403).json({ error: 'Unauthorized access' });
    }

    res.json(analysis);
  } catch (error) {
    console.error('Analysis detail error:', error);
    res.status(500).json({ error: 'Error fetching analysis detail' });
  }
});

// 기간별 분석 결과 조회
router.get('/user/:user_id/history/period', auth, async (req, res) => {
  try {
    // 권한 확인
    if (req.user.user_id !== req.params.user_id) {
      return res.status(403).json({ error: 'Unauthorized access' });
    }

    // 쿼리 파라미터에서 시작일과 종료일 가져오기
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

// 분석 결과 통계
router.get('/user/:user_id/statistics', auth, async (req, res) => {
  try {
    // 권한 확인
    if (req.user.user_id !== req.params.user_id) {
      return res.status(403).json({ error: 'Unauthorized access' });
    }

    const analyses = await Analysis.find({ user_id: req.params.user_id });
    
    // 통계 계산
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
      // 평균 점수 계산
      statistics.average_scores.face = analyses.reduce((sum, analysis) => 
        sum + analysis.face_analysis.score, 0) / analyses.length;
      
      statistics.average_scores.voice_confidence = analyses.reduce((sum, analysis) => 
        sum + analysis.voice_analysis.confidence, 0) / analyses.length;
      
      statistics.average_scores.stress_level = analyses.reduce((sum, analysis) => 
        sum + analysis.voice_analysis.stress_level, 0) / analyses.length;

      // 감정 분포 계산
      analyses.forEach(analysis => {
        const emotion = analysis.face_analysis.emotion;
        statistics.emotion_distribution[emotion] = (statistics.emotion_distribution[emotion] || 0) + 1;
      });

      // 최근 5개 분석의 추세
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