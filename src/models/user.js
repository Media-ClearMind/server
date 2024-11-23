const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

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
 *         _id:
 *           type: string
 *           description: 사용자의 고유 ID
 *         username:
 *           type: string
 *           description: 사용자 아이디 (중복 불가)
 *         password:
 *           type: string
 *           description: 암호화된 비밀번호
 *         age:
 *           type: number
 *           description: 사용자 나이
 *         gender:
 *           type: string
 *           enum: [male, female, other]
 *           description: 사용자 성별
 *         occupation:
 *           type: string
 *           description: 사용자 직업
 *         kakaoId:
 *           type: string
 *           description: 카카오 로그인 사용자의 카카오 ID
 *         createdAt:
 *           type: string
 *           format: date-time
 *           description: 계정 생성 시간
 *     UserResponse:
 *       type: object
 *       properties:
 *         _id:
 *           type: string
 *           description: 사용자의 고유 ID
 *         username:
 *           type: string
 *           description: 사용자 아이디
 *         age:
 *           type: number
 *           description: 사용자 나이
 *         gender:
 *           type: string
 *           description: 사용자 성별
 *         occupation:
 *           type: string
 *           description: 사용자 직업
 *         createdAt:
 *           type: string
 *           format: date-time
 *           description: 계정 생성 시간
 */

const userSchema = new mongoose.Schema({
  username: {
    type: String,
    required: true,
    unique: true,
    trim: true
  },
  password: {
    type: String,
    required: true
  },
  age: {
    type: Number,
    required: true
  },
  gender: {
    type: String,
    required: true,
    enum: ['male', 'female', 'other']
  },
  occupation: {
    type: String,
    required: true
  },
  kakaoId: {
    type: String,
    sparse: true
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

// 비밀번호 해싱 미들웨어
userSchema.pre('save', async function(next) {
  if (!this.isModified('password')) return next();
  
  try {
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (error) {
    next(error);
  }
});

// 비밀번호 검증 메소드
userSchema.methods.comparePassword = async function(candidatePassword) {
  return bcrypt.compare(candidatePassword, this.password);
};

const User = mongoose.model('User', userSchema);

module.exports = User;