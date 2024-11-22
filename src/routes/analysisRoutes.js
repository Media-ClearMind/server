const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const Analysis = require('../models/analysis');

// 분석 결과 저장
router.post('/submit', auth, async (req, res) => {
  try {
    const analysis = new Analysis({
      user_id: req.user.user_id,
      ...req.body
    });

    await analysis.save();
    res.status(201).json({ message: 'Analysis result submitted successfully.' });
  } catch (error) {
    console.error('Analysis submission error:', error);
    res.status(400).json({ error: 'Invalid input data.' });
  }
});

// 사용자 분석 기록 조회
router.get('/user/:user_id/history', auth, async (req, res) => {
  try {
    // 권한 확인
    if (req.user.user_id !== req.params.user_id) {
      return res.status(403).json({ error: 'Unauthorized access' });
    }

    const analysisHistory = await Analysis.find({ user_id: req.params.user_id })
      .sort({ createdAt: -1 })
      .select('createdAt result.summary face_analysis.score');

    const formattedHistory = analysisHistory.map(analysis => ({
      analysis_id: analysis._id,
      date: analysis.createdAt,
      summary: analysis.result.summary,
      score: analysis.face_analysis.score
    }));

    res.json({
      user_id: req.params.user_id,
      analysis_history: formattedHistory
    });
  } catch (error) {
    console.error('Analysis history error:', error);
    res.status(404).json({ error: 'User not found.' });
  }
});

module.exports = router;