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

/**
 * @swagger
 * /api/users/profile:
 *   get:
 *     summary: 사용자 프로필 조회
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: 프로필 조회 성공
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 username:
 *                   type: string
 *                 age:
 *                   type: number
 *                 gender:
 *                   type: string
 *                 occupation:
 *                   type: string
 *       401:
 *         description: 인증 실패
 *       404:
 *         description: 사용자를 찾을 수 없음
 */
router.get('/profile', auth, async (req, res) => {
  try {
    const user = await User.findById(req.user.user_id)
      .select('-password');
    
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json(user);
  } catch (error) {
    console.error('Profile fetch error:', error);
    res.status(500).json({ error: 'Error fetching profile' });
  }
});

/**
 * @swagger
 * /api/users/profile:
 *   put:
 *     summary: 사용자 프로필 수정
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               age:
 *                 type: number
 *               gender:
 *                 type: string
 *               occupation:
 *                 type: string
 *     responses:
 *       200:
 *         description: 프로필 수정 성공
 *       400:
 *         description: 잘못된 입력
 *       401:
 *         description: 인증 실패
 */
router.put('/profile', auth, async (req, res) => {
  try {
    const { age, gender, occupation } = req.body;
    
    const updateFields = {};
    if (age) updateFields.age = age;
    if (gender) updateFields.gender = gender;
    if (occupation) updateFields.occupation = occupation;

    const user = await User.findByIdAndUpdate(
      req.user.user_id,
      { $set: updateFields },
      { new: true, select: '-password' }
    );

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({
      message: 'Profile updated successfully',
      user
    });
  } catch (error) {
    console.error('Profile update error:', error);
    res.status(400).json({ error: 'Error updating profile' });
  }
});

/**
 * @swagger
 * /api/users/change-password:
 *   put:
 *     summary: 비밀번호 변경
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - currentPassword
 *               - newPassword
 *             properties:
 *               currentPassword:
 *                 type: string
 *               newPassword:
 *                 type: string
 *     responses:
 *       200:
 *         description: 비밀번호 변경 성공
 *       400:
 *         description: 잘못된 요청
 *       401:
 *         description: 현재 비밀번호가 일치하지 않음
 */
router.put('/change-password', auth, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({ 
        error: 'Current password and new password are required' 
      });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({ 
        error: 'New password must be at least 6 characters long' 
      });
    }

    const user = await User.findById(req.user.user_id);
    
    const isMatch = await user.comparePassword(currentPassword);
    if (!isMatch) {
      return res.status(401).json({ error: 'Current password is incorrect' });
    }

    if (currentPassword === newPassword) {
      return res.status(400).json({ 
        error: 'New password must be different from current password' 
      });
    }

    user.password = newPassword;
    await user.save();

    res.json({ message: 'Password changed successfully' });
  } catch (error) {
    console.error('Password change error:', error);
    res.status(500).json({ error: 'Error changing password' });
  }
});

/**
 * @swagger
 * /api/users/account:
 *   delete:
 *     summary: 회원 탈퇴
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - password
 *             properties:
 *               password:
 *                 type: string
 *     responses:
 *       200:
 *         description: 계정 삭제 성공
 *       400:
 *         description: 잘못된 요청
 *       401:
 *         description: 비밀번호가 일치하지 않음
 */
router.delete('/account', auth, async (req, res) => {
  try {
    const { password } = req.body;

    if (!password) {
      return res.status(400).json({ error: 'Password is required' });
    }

    const user = await User.findById(req.user.user_id);
    
    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return res.status(401).json({ error: 'Password is incorrect' });
    }

    // Analysis 모델 import 필요
    const Analysis = require('../models/analysis');
    await Analysis.deleteMany({ user_id: req.user.user_id });
    
    await User.findByIdAndDelete(req.user.user_id);

    res.json({ message: 'Account deleted successfully' });
  } catch (error) {
    console.error('Account deletion error:', error);
    res.status(500).json({ error: 'Error deleting account' });
  }
});

module.exports = router;