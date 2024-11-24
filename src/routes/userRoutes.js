const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const User = require('../models/user');
const auth = require('../middleware/auth');
const Analysis = require('../models/analysis');

/**
 * @swagger
 * components:
 *   schemas:
 *     User:
 *       type: object
 *       required:
 *         - email
 *         - password
 *         - name
 *         - age
 *         - gender
 *         - occupation
 *       properties:
 *         email:
 *           type: string
 *           format: email
 *           description: 사용자 이메일
 *         name:
 *           type: string
 *           description: 사용자 이름
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
 *         count:
 *           type: number
 *           description: 사용자의 인터뷰 진행 횟수
 *           default: 0
 *         kakaoId:
 *           type: string
 *           description: 카카오 로그인 사용자의 카카오 ID
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
 *               - email
 *               - password
 *               - name
 *               - age
 *               - gender
 *               - occupation
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *               name:
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
 *         description: 잘못된 요청 (중복된 이메일이거나 필수 필드 누락)
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *       500:
 *         description: 서버 에러
 */
router.post('/register', async (req, res) => {
  try {
    const { email, password, name, age, gender, occupation } = req.body;
    
    if (!email || !password || !name || !age || !gender || !occupation) {
      return res.status(400).json({ error: 'All fields are required' });
    }

    const existingUser = await User.findOne({ email: email.toLowerCase() });
    if (existingUser) {
      return res.status(400).json({ error: 'Email already exists' });
    }

    const user = new User({
      email: email.toLowerCase(),
      password,
      name,
      age,
      gender,
      occupation,
      count: 0  // 초기 count 설정
    });

    await user.save();
    res.status(201).json({ message: 'User registered successfully.' });
  } catch (error) {
    console.error('Registration error:', error);
    if (error.code === 11000) {
      return res.status(400).json({ error: 'Email already exists' });
    }
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
 *               - email
 *               - password
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
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
 *                     email:
 *                       type: string
 *                     name:
 *                       type: string
 *                     count:
 *                       type: number
 *       401:
 *         description: 인증 실패
 *       500:
 *         description: 서버 에러
 */
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    
    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user) {
      return res.status(401).json({ error: 'Invalid email or password.' });
    }

    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return res.status(401).json({ error: 'Invalid email or password.' });
    }

    const token = jwt.sign(
      { 
        user_id: user._id,
        email: user.email
      },
      process.env.JWT_SECRET,
      { expiresIn: '24h' }
    );

    res.json({ 
      token,
      user: {
        id: user._id,
        email: user.email,
        name: user.name,
        count: user.count
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
 *                     email:
 *                       type: string
 *                     name:
 *                       type: string
 *                     count:
 *                       type: number
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
      const kakaoEmail = kakaoUser.kakao_account?.email;
      const kakaoName = kakaoUser.properties?.nickname || 'Kakao User';
      
      user = new User({
        email: kakaoEmail || `kakao_${kakaoUser.id}@kakao.com`,
        name: kakaoName,
        password: Math.random().toString(36).slice(-8),
        kakaoId: kakaoUser.id,
        age: 0,
        gender: 'other',
        occupation: 'not specified',
        count: 0  // 초기 count 설정
      });
      await user.save();
    }

    const token = jwt.sign(
      { 
        user_id: user._id,
        email: user.email
      },
      process.env.JWT_SECRET,
      { expiresIn: '24h' }
    );

    res.json({ 
      token,
      user: {
        id: user._id,
        email: user.email,
        name: user.name,
        count: user.count
      }
    });
  } catch (error) {
    console.error('Kakao login error:', error);
    res.status(400).json({ error: 'Kakao login failed.' });
  }
});

/**
 * @swagger
 * /api/users/count:
 *   get:
 *     summary: 현재 사용자의 인터뷰 카운트 조회
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: 카운트 조회 성공
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 count:
 *                   type: number
 *                   description: 현재 인터뷰 횟수
 *       401:
 *         description: 인증 실패
 *       404:
 *         description: 사용자를 찾을 수 없음
 */
router.get('/count', auth, async (req, res) => {
  try {
    const user = await User.findById(req.user.user_id);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({ count: user.count || 0 });
  } catch (error) {
    console.error('Count fetch error:', error);
    res.status(500).json({ error: 'Failed to fetch count' });
  }
});

/**
 * @swagger
 * /api/users/increment-count:
 *   post:
 *     summary: 사용자의 인터뷰 카운트 증가
 *     description: 사용자의 인터뷰 count를 1 증가시킵니다.
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: 카운트 증가 성공
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: Count incremented successfully
 *                 currentCount:
 *                   type: number
 *                   description: 증가된 후의 현재 카운트
 *                   example: 1
 *       401:
 *         description: 인증 실패
 *       404:
 *         description: 사용자를 찾을 수 없음
 *       500:
 *         description: 서버 에러
 */
router.post('/increment-count', auth, async (req, res) => {
  try {
    const user = await User.findById(req.user.user_id);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    user.count = (user.count || 0) + 1;
    await user.save();

    res.json({ 
      message: 'Count incremented successfully',
      currentCount: user.count
    });
  } catch (error) {
    console.error('Count increment error:', error);
    res.status(500).json({ error: 'Failed to increment count' });
  }
});

// ... (나머지 라우트들: profile, change-password, account delete 등은 유지)

module.exports = router;

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
 *                 email:
 *                   type: string
 *                 name:
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
 *               name:
 *                 type: string
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
    const { name, age, gender, occupation } = req.body;
    
    const updateFields = {};
    if (name) updateFields.name = name;
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

    await Analysis.deleteMany({ user_id: req.user.user_id });
    await User.findByIdAndDelete(req.user.user_id);

    res.json({ message: 'Account deleted successfully' });
  } catch (error) {
    console.error('Account deletion error:', error);
    res.status(500).json({ error: 'Error deleting account' });
  }
});

/**
 * @swagger
 * /api/users/increment-count:
 *   post:
 *     summary: 사용자의 인터뷰 카운트 증가
 *     description: 사용자의 인터뷰 count를 1 증가시킵니다.
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: 카운트 증가 성공
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: Count incremented successfully
 *                 currentCount:
 *                   type: number
 *                   description: 증가된 후의 현재 카운트
 *                   example: 1
 *       401:
 *         description: 인증 실패
 *       500:
 *         description: 서버 에러
 */
router.post('/increment-count', auth, async (req, res) => {
  try {
    const user = await User.findByIdAndUpdate(
      req.user.user_id,
      { $inc: { count: 1 } },
      { new: true }
    );

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({ 
      message: 'Count incremented successfully',
      currentCount: user.count
    });
  } catch (error) {
    console.error('Count increment error:', error);
    res.status(500).json({ error: 'Failed to increment count' });
  }
});

module.exports = router;