const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const User = require('../models/user');

/**
 * @swagger
 * components:
 *   schemas:
 *     User:
 *       type: object
 *       required:
 *         - username
 *         - password
 *         - age
 *         - gender
 *         - occupation
 *       properties:
 *         username:
 *           type: string
 *           description: 사용자 아이디
 *         password:
 *           type: string
 *           description: 사용자 비밀번호
 *         age:
 *           type: number
 *           description: 사용자 나이
 *         gender:
 *           type: string
 *           description: 사용자 성별
 *         occupation:
 *           type: string
 *           description: 사용자 직업
 */

/**
 * @swagger
 * /api/users/register:
 *   post:
 *     summary: 새로운 사용자 등록
 *     tags: [Users]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - username
 *               - password
 *               - age
 *               - gender
 *               - occupation
 *             properties:
 *               username:
 *                 type: string
 *               password:
 *                 type: string
 *               age:
 *                 type: number
 *               gender:
 *                 type: string
 *               occupation:
 *                 type: string
 *     responses:
 *       201:
 *         description: 회원가입 성공
 *       400:
 *         description: 잘못된 요청 (중복된 username이거나 필수 필드 누락)
 *       500:
 *         description: 서버 에러
 */
router.post('/register', async (req, res) => {
  try {
    const { username, password, age, gender, occupation } = req.body;
    
    const existingUser = await User.findOne({ username });
    if (existingUser) {
      return res.status(400).json({ error: 'Username already exists' });
    }

    if (!username || !password || !age || !gender || !occupation) {
      return res.status(400).json({ error: 'All fields are required' });
    }

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
    console.error('Registration error:', error);
    res.status(500).json({ error: 'Registration failed.' });
  }
});

/**
 * @swagger
 * /api/users/login:
 *   post:
 *     summary: 사용자 로그인
 *     tags: [Users]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - username
 *               - password
 *             properties:
 *               username:
 *                 type: string
 *               password:
 *                 type: string
 *     responses:
 *       200:
 *         description: 로그인 성공
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 token:
 *                   type: string
 *                   description: JWT 토큰
 *                 user:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: string
 *                     username:
 *                       type: string
 *       401:
 *         description: 인증 실패
 *       500:
 *         description: 서버 에러
 */
router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    
    const user = await User.findOne({ username });
    if (!user) {
      return res.status(401).json({ error: 'Invalid username or password.' });
    }

    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return res.status(401).json({ error: 'Invalid username or password.' });
    }

    const token = jwt.sign(
      { 
        user_id: user._id,
        username: user.username
      },
      process.env.JWT_SECRET,
      { expiresIn: '24h' }
    );

    res.json({ 
      token,
      user: {
        id: user._id,
        username: user.username
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Login failed.' });
  }
});

/**
 * @swagger
 * /api/users/kakao-login:
 *   post:
 *     summary: 카카오 로그인
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     description: 카카오 액세스 토큰을 사용하여 로그인
 *     responses:
 *       200:
 *         description: 로그인 성공
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 token:
 *                   type: string
 *                   description: JWT 토큰
 *                 user:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: string
 *                     username:
 *                       type: string
 *       400:
 *         description: 잘못된 요청 또는 카카오 로그인 실패
 */
router.post('/kakao-login', async (req, res) => {
  try {
    const kakaoToken = req.headers.authorization?.replace('Bearer ', '');
    if (!kakaoToken) {
      return res.status(400).json({ error: 'Kakao token is required.' });
    }

    const response = await fetch('https://kapi.kakao.com/v2/user/me', {
      headers: {
        Authorization: `Bearer ${kakaoToken}`
      }
    });

    if (!response.ok) {
      throw new Error('Failed to fetch Kakao user info');
    }

    const kakaoUser = await response.json();
    
    let user = await User.findOne({ kakaoId: kakaoUser.id });
    
    if (!user) {
      user = new User({
        username: `kakao_${kakaoUser.id}`,
        password: Math.random().toString(36).slice(-8),
        kakaoId: kakaoUser.id,
        age: 0,
        gender: 'other',
        occupation: 'not specified'
      });
      await user.save();
    }

    const token = jwt.sign(
      { 
        user_id: user._id,
        username: user.username
      },
      process.env.JWT_SECRET,
      { expiresIn: '24h' }
    );

    res.json({ 
      token,
      user: {
        id: user._id,
        username: user.username
      }
    });
  } catch (error) {
    console.error('Kakao login error:', error);
    res.status(400).json({ error: 'Kakao login failed.' });
  }
});

module.exports = router;