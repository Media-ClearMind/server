/**
 * @swagger
 * components:
 *   schemas:
 *     ValidationError:
 *       type: object
 *       properties:
 *         errors:
 *           type: object
 *           properties:
 *             username:
 *               type: string
 *               example: "Username must be at least 3 characters long"
 *             password:
 *               type: string
 *               example: "Password must be at least 6 characters long"
 *             age:
 *               type: string
 *               example: "Age must be a positive number"
 *             gender:
 *               type: string
 *               example: "Invalid gender specified"
 *             occupation:
 *               type: string
 *               example: "Occupation is required"
 *         isValid:
 *           type: boolean
 *           description: 유효성 검사 통과 여부
 *     RegisterInput:
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
 *           minLength: 3
 *           description: 사용자명 (최소 3자)
 *         password:
 *           type: string
 *           minLength: 6
 *           description: 비밀번호 (최소 6자)
 *         age:
 *           type: integer
 *           minimum: 0
 *           description: 나이
 *         gender:
 *           type: string
 *           enum: [male, female, other]
 *           description: 성별
 *         occupation:
 *           type: string
 *           description: 직업
 *     AnalysisInput:
 *       type: object
 *       required:
 *         - face_analysis
 *         - voice_analysis
 *         - result
 *       properties:
 *         face_analysis:
 *           type: object
 *           required:
 *             - emotion
 *             - score
 *           properties:
 *             emotion:
 *               type: string
 *               description: 감지된 감정
 *             score:
 *               type: number
 *               minimum: 0
 *               maximum: 1
 *               description: 얼굴 분석 점수 (0-1 사이)
 *         voice_analysis:
 *           type: object
 *           required:
 *             - stress_level
 *             - confidence
 *           properties:
 *             stress_level:
 *               type: number
 *               description: 스트레스 레벨
 *             confidence:
 *               type: number
 *               description: 음성 분석 신뢰도
 *         result:
 *           type: object
 *           required:
 *             - summary
 *           properties:
 *             summary:
 *               type: string
 *               description: 분석 결과 요약
 */

const validateRegisterInput = (data) => {
  const errors = {};

  if (!data.username || data.username.trim().length < 3) {
    errors.username = 'Username must be at least 3 characters long';
  }

  if (!data.password || data.password.length < 6) {
    errors.password = 'Password must be at least 6 characters long';
  }

  if (!Number.isInteger(data.age) || data.age < 0) {
    errors.age = 'Age must be a positive number';
  }

  if (!['male', 'female', 'other'].includes(data.gender)) {
    errors.gender = 'Invalid gender specified';
  }

  if (!data.occupation || data.occupation.trim().length === 0) {
    errors.occupation = 'Occupation is required';
  }

  return {
    errors,
    isValid: Object.keys(errors).length === 0
  };
};

const validateAnalysisInput = (data) => {
  const errors = {};

  if (!data.face_analysis || !data.face_analysis.emotion) {
    errors.face_analysis = 'Face analysis data is required';
  }
  if (!data.face_analysis?.score || data.face_analysis.score < 0 || data.face_analysis.score > 1) {
    errors.face_analysis_score = 'Face analysis score must be between 0 and 1';
  }

  if (!data.voice_analysis?.stress_level || !data.voice_analysis?.confidence) {
    errors.voice_analysis = 'Voice analysis data is incomplete';
  }

  if (!data.result?.summary) {
    errors.result = 'Analysis result summary is required';
  }

  return {
    errors,
    isValid: Object.keys(errors).length === 0
  };
};

module.exports = {
  validateRegisterInput,
  validateAnalysisInput
};