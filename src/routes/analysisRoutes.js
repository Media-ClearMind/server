// routes/userRoutes.js
const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const User = require('../models/user');

// 회원가입
router.post('/register', async (req, res) => {
  try {
    const { username, password, age, gender, occupation } = req.body;
    
    // 기존 사용자 확인
    const existingUser = await User.findOne({ username });
    if (existingUser) {
      return res.status(400).json({ error: 'Username already exists' });
    }

    // 새 사용자 생성
    const user = new User({
      username,
      password,
      age,
      gender,
      occupation
    });

    await user.save();
    res.status(201).json({ message: 'User registered successfully.' });
  } catch (error) {
    res.status(400).json({ error: 'Invalid input data.' });
  }
});

// 로그인
router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    
    // 사용자 찾기
    const user = await User.findOne({ username });
    if (!user) {
      return res.status(401).json({ error: 'Invalid username or password.' });
    }

    // 비밀번호 확인
    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return res.status(401).json({ error: 'Invalid username or password.' });
    }

    // JWT 토큰 생성
    const token = jwt.sign(
      { user_id: user._id },
      process.env.JWT_SECRET,
      { expiresIn: '24h' }
    );

    res.json({ token });
  } catch (error) {
    res.status(500).json({ error: 'Login failed.' });
  }
});

// 카카오 로그인
router.post('/kakao-login', async (req, res) => {
  try {
    const kakaoToken = req.headers.authorization?.replace('Bearer ', '');
    if (!kakaoToken) {
      return res.status(400).json({ error: 'Kakao token is required.' });
    }

    // 카카오 API로 사용자 정보 조회
    const response = await fetch('https://kapi.kakao.com/v2/user/me', {
      headers: {
        Authorization: `Bearer ${kakaoToken}`
      }
    });

    const kakaoUser = await response.json();
    
    // 기존 카카오 회원 찾기 또는 새로 생성
    let user = await User.findOne({ kakaoId: kakaoUser.id });
    
    if (!user) {
      user = new User({
        username: `kakao_${kakaoUser.id}`,
        password: Math.random().toString(36), // 임시 비밀번호
        kakaoId: kakaoUser.id,
        // 추가 필요한 필드는 카카오에서 받아오거나 나중에 업데이트
        age: 0,
        gender: 'other',
        occupation: 'not specified'
      });
      await user.save();
    }

    // JWT 토큰 생성
    const token = jwt.sign(
      { user_id: user._id },
      process.env.JWT_SECRET,
      { expiresIn: '24h' }
    );

    res.json({ token });
  } catch (error) {
    res.status(400).json({ error: 'Kakao login failed.' });
  }
});

module.exports = router;