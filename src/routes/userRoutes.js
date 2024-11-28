const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');
const User = require('../models/user');
const Analysis = require('../models/analysis');
const auth = require('../middleware/auth');
const { body, validationResult } = require('express-validator');

// 표준화된 응답 생성 헬퍼 함수
const createResponse = (success, message, data = null, meta = null) => ({
  status: success ? 'success' : 'error',
  message,
  data,
  meta
});

// 유효성 검증 규칙
const userValidationRules = {
  register: [
    body('email').isEmail().normalizeEmail(),
    body('password').isLength({ min: 6 }),
    body('name').trim().notEmpty(),
    body('age').isInt({ min: 1, max: 120 }),
    body('gender').isIn(['male', 'female', 'other']),
    body('occupation').trim().notEmpty()
  ],
  login: [
    body('email').isEmail().normalizeEmail(),
    body('password').notEmpty()
  ],
  changePassword: [
    body('currentPassword').notEmpty(),
    body('newPassword').isLength({ min: 6 })
  ],
  updateProfile: [
    body('name').optional().trim().notEmpty(),
    body('age').optional().isInt({ min: 1, max: 120 }),
    body('gender').optional().isIn(['male', 'female', 'other']),
    body('occupation').optional().trim().notEmpty()
  ]
};

// 유효성 검증 미들웨어
const validateRequest = (rules) => {
  return async (req, res, next) => {
    await Promise.all(rules.map(validation => validation.run(req)));
    
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json(createResponse(
        false,
        'Validation failed',
        null,
        { errors: errors.array() }
      ));
    }
    next();
  };
};

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
 *             $ref: '#/components/schemas/User'
 *     responses:
 *       201:
 *         description: 회원가입 성공
 */
router.post(
  '/register',
  validateRequest(userValidationRules.register),
  async (req, res) => {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      const { email, password, name, age, gender, occupation } = req.body;

      const existingUser = await User.findOne({ email: email.toLowerCase() });
      if (existingUser) {
        return res.status(400).json(createResponse(
          false,
          'Email already exists'
        ));
      }

      const user = new User({
        email: email.toLowerCase(),
        password,
        name,
        age,
        gender,
        occupation,
        count: 0
      });

      await user.save({ session });
      await session.commitTransaction();

      res.status(201).json(createResponse(
        true,
        'User registered successfully'
      ));
    } catch (error) {
      await session.abortTransaction();
      console.error('Registration error:', error);
      
      if (error.code === 11000) {
        return res.status(400).json(createResponse(
          false,
          'Email already exists'
        ));
      }
      
      res.status(500).json(createResponse(
        false,
        'Registration failed'
      ));
    } finally {
      session.endSession();
    }
  }
);

/**
 * @swagger
 * /api/users/login:
 *   post:
 *     summary: 사용자 로그인
 *     tags: [Users]
 */
router.post(
  '/login',
  validateRequest(userValidationRules.login),
  async (req, res) => {
    try {
      const { email, password } = req.body;
      
      const user = await User.findOne({ email: email.toLowerCase() });
      if (!user) {
        return res.status(401).json(createResponse(
          false,
          'Invalid credentials'
        ));
      }

      const isMatch = await user.comparePassword(password);
      if (!isMatch) {
        return res.status(401).json(createResponse(
          false,
          'Invalid credentials'
        ));
      }

      const token = jwt.sign(
        { 
          user_id: user._id,
          email: user.email
        },
        process.env.JWT_SECRET,
        { expiresIn: '24h' }
      );

      res.json(createResponse(true, 'Login successful', {
        token,
        user: {
          id: user._id,
          email: user.email,
          name: user.name,
          count: user.count
        }
      }));
    } catch (error) {
      console.error('Login error:', error);
      res.status(500).json(createResponse(false, 'Login failed'));
    }
  }
);

/**
 * @swagger
 * /api/users/kakao-login:
 *   post:
 *     summary: 카카오 로그인
 *     tags: [Users]
 */
router.post('/kakao-login', async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const kakaoToken = req.headers.authorization?.replace('Bearer ', '');
    if (!kakaoToken) {
      return res.status(400).json(createResponse(
        false,
        'Kakao token is required'
      ));
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
    let user = await User.findOne({ kakaoId: kakaoUser.id }).session(session);
    
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
        count: 0
      });
      await user.save({ session });
    }

    const token = jwt.sign(
      { 
        user_id: user._id,
        email: user.email
      },
      process.env.JWT_SECRET,
      { expiresIn: '24h' }
    );

    await session.commitTransaction();

    res.json(createResponse(true, 'Kakao login successful', {
      token,
      user: {
        id: user._id,
        email: user.email,
        name: user.name,
        count: user.count
      }
    }));
  } catch (error) {
    await session.abortTransaction();
    console.error('Kakao login error:', error);
    res.status(400).json(createResponse(false, 'Kakao login failed'));
  } finally {
    session.endSession();
  }
});

/**
 * @swagger
 * /api/users/profile:
 *   get:
 *     summary: 사용자 프로필 조회
 *     tags: [Users]
 */
router.get('/profile', auth(), async (req, res) => {
  try {
    const user = await User.findById(req.user.user_id)
      .select('-password -__v');
    
    if (!user) {
      return res.status(404).json(createResponse(
        false,
        'User not found'
      ));
    }

    res.json(createResponse(true, 'Profile fetched successfully', user));
  } catch (error) {
    console.error('Profile fetch error:', error);
    res.status(500).json(createResponse(false, 'Error fetching profile'));
  }
});

/**
 * @swagger
 * /api/users/profile:
 *   put:
 *     summary: 사용자 프로필 수정
 *     tags: [Users]
 */
router.put(
  '/profile',
  auth(),
  validateRequest(userValidationRules.updateProfile),
  async (req, res) => {
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
        { new: true, select: '-password -__v' }
      );

      if (!user) {
        return res.status(404).json(createResponse(
          false,
          'User not found'
        ));
      }

      res.json(createResponse(true, 'Profile updated successfully', user));
    } catch (error) {
      console.error('Profile update error:', error);
      res.status(400).json(createResponse(false, 'Error updating profile'));
    }
  }
);

/**
 * @swagger
 * /api/users/change-password:
 *   put:
 *     summary: 비밀번호 변경
 *     tags: [Users]
 */
router.put(
  '/change-password',
  auth(),
  validateRequest(userValidationRules.changePassword),
  async (req, res) => {
    try {
      const { currentPassword, newPassword } = req.body;

      // 새 비밀번호와 현재 비밀번호가 같은지 먼저 확인
      if (currentPassword === newPassword) {
        return res.status(400).json(createResponse(
          false,
          'New password must be different from current password'
        ));
      }

      const user = await User.findById(req.user.user_id);
      
      const isMatch = await user.comparePassword(currentPassword);
      if (!isMatch) {
        return res.status(401).json(createResponse(
          false,
          'Current password is incorrect'
        ));
      }

      user.password = newPassword;
      await user.save();

      res.json(createResponse(true, 'Password changed successfully'));
    } catch (error) {
      console.error('Password change error:', error);
      res.status(500).json(createResponse(false, 'Error changing password'));
    }
  }
);

/**
 * @swagger
 * /api/users/count:
 *   get:
 *     summary: 현재 사용자의 인터뷰 카운트 조회
 *     tags: [Users]
 */
router.get('/count', auth(), async (req, res) => {
  try {
    const user = await User.findById(req.user.user_id)
      .select('count');
      
    if (!user) {
      return res.status(404).json(createResponse(
        false,
        'User not found'
      ));
    }

    res.json(createResponse(true, 'Count fetched successfully', {
      count: user.count || 0
    }));
  } catch (error) {
    console.error('Count fetch error:', error);
    res.status(500).json(createResponse(false, 'Failed to fetch count'));
  }
});

/**
 * @swagger
 * /api/users/increment-count:
 *   post:
 *     summary: 사용자의 인터뷰 카운트 증가
 *     tags: [Users]
 */
router.post('/increment-count', auth(), async (req, res) => {
  try {
    const user = await User.findByIdAndUpdate(
      req.user.user_id,
      { $inc: { count: 1 } },
      { new: true, select: 'count' }
    );

    if (!user) {
      return res.status(404).json(createResponse(
        false,
        'User not found'
      ));
    }

    res.json(createResponse(true, 'Count incremented successfully', {
      currentCount: user.count
    }));
  } catch (error) {
    console.error('Count increment error:', error);
    res.status(500).json(createResponse(false, 'Failed to increment count'));
  }
});

/**
 * @swagger
 * /api/users/account:
 *   delete:
 *     summary: 회원 탈퇴
 *     tags: [Users]
 */
router.delete('/account', auth(), async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { password } = req.body;

    if (!password) {
      return res.status(400).json(createResponse(
        false,
        'Password is required'
      ));
    }

    const user = await User.findById(req.user.user_id);
    
    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return res.status(401).json(createResponse(
        false,
        'Password is incorrect'
      ));
    }

    // 관련된 모든 데이터 삭제
    await Analysis.deleteMany(
      { user_id: req.user.user_id },
      { session }
    );
    await User.findByIdAndDelete(req.user.user_id, { session });

    await session.commitTransaction();
    res.json(createResponse(true, 'Account deleted successfully'));
  } catch (error) {
    await session.abortTransaction();
    console.error('Account deletion error:', error);
    res.status(500).json(createResponse(false, 'Error deleting account'));
  } finally {
    session.endSession();
  }
});

module.exports = router;