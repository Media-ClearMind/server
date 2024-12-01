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
    body('gender').isIn(['남성', '여성', '기타']),
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
    body('gender').optional().isIn(['남성', '여성', '기타']),
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
 *     description: 새로운 사용자 계정을 생성합니다.
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
 *                 description: 사용자 이메일 주소
 *               password:
 *                 type: string
 *                 minLength: 6
 *                 description: 비밀번호 (최소 6자)
 *               name:
 *                 type: string
 *                 description: 사용자 이름
 *               age:
 *                 type: integer
 *                 minimum: 1
 *                 maximum: 120
 *                 description: 사용자 나이
 *               gender:
 *                 type: string
 *                 enum: [남성, 여성, 기타]
 *                 description: 성별
 *               occupation:
 *                 type: string
 *                 description: 직업
 *     responses:
 *       201:
 *         description: 회원가입 성공
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: success
 *                 message:
 *                   type: string
 *                   example: User registered successfully
 *       400:
 *         description: 잘못된 요청 (유효성 검증 실패)
 *       409:
 *         description: 이메일 중복
 *
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
 *     description: 이메일과 비밀번호로 로그인합니다.
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
 *                 description: 사용자 이메일
 *               password:
 *                 type: string
 *                 description: 비밀번호
 *     responses:
 *       200:
 *         description: 로그인 성공
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: success
 *                 message:
 *                   type: string
 *                 data:
 *                   type: object
 *                   properties:
 *                     token:
 *                       type: string
 *                       description: JWT 토큰
 *                     user:
 *                       type: object
 *                       properties:
 *                         id:
 *                           type: string
 *                         email:
 *                           type: string
 *                         name:
 *                           type: string
 *                         count:
 *                           type: integer
 *       401:
 *         description: 인증 실패
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
 *     description: 카카오 액세스 토큰을 사용하여 로그인합니다.
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: 카카오 로그인 성공
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/LoginResponse'
 *       400:
 *         description: 잘못된 요청 또는 카카오 토큰 오류
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
 *     description: 현재 로그인한 사용자의 프로필 정보를 조회합니다.
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: 프로필 조회 성공
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/UserResponse'
 *       401:
 *         description: 인증되지 않은 접근
 *       404:
 *         description: 사용자를 찾을 수 없음
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
 *     description: 현재 로그인한 사용자의 프로필 정보를 수정합니다.
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
 *                 type: integer
 *                 minimum: 1
 *                 maximum: 120
 *               gender:
 *                 type: string
 *                 enum: [남성, 여성, 기타]
 *               occupation:
 *                 type: string
 *     responses:
 *       200:
 *         description: 프로필 수정 성공
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/UserResponse'
 *       400:
 *         description: 잘못된 요청
 *       401:
 *         description: 인증되지 않은 접근
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
 *     description: 현재 로그인한 사용자의 비밀번호를 변경합니다.
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
 *                 description: 현재 비밀번호
 *               newPassword:
 *                 type: string
 *                 minLength: 6
 *                 description: 새 비밀번호
 *     responses:
 *       200:
 *         description: 비밀번호 변경 성공
 *       401:
 *         description: 현재 비밀번호가 일치하지 않음
 *       400:
 *         description: 잘못된 요청
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
 *     description: 현재 로그인한 사용자의 인터뷰 회차를 조회합니다.
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
 *                 status:
 *                   type: string
 *                   example: success
 *                 data:
 *                   type: object
 *                   properties:
 *                     count:
 *                       type: integer
 *       401:
 *         description: 인증되지 않은 접근
 *       404:
 *         description: 사용자를 찾을 수 없음
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
 *     description: 현재 로그인한 사용자의 인터뷰 회차를 1 증가시킵니다.
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
 *                 status:
 *                   type: string
 *                   example: success
 *                 data:
 *                   type: object
 *                   properties:
 *                     currentCount:
 *                       type: integer
 *       401:
 *         description: 인증되지 않은 접근
 *       404:
 *         description: 사용자를 찾을 수 없음
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
 *     description: 현재 로그인한 사용자의 계정을 삭제합니다.
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
 *                 description: 계정 삭제 확인을 위한 현재 비밀번호
 *     responses:
 *       200:
 *         description: 계정 삭제 성공
 *       401:
 *         description: 비밀번호가 일치하지 않음
 *       500:
 *         description: 서버 에러
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