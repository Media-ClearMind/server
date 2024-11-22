// utils/validation.js
// 사용자 입력 데이터 검증 함수들

// 사용자 등록 데이터 검증
const validateRegisterInput = (data) => {
    const errors = {};
  
    // 사용자명 검증
    if (!data.username || data.username.trim().length < 3) {
      errors.username = 'Username must be at least 3 characters long';
    }
  
    // 비밀번호 검증
    if (!data.password || data.password.length < 6) {
      errors.password = 'Password must be at least 6 characters long';
    }
  
    // 나이 검증
    if (!Number.isInteger(data.age) || data.age < 0) {
      errors.age = 'Age must be a positive number';
    }
  
    // 성별 검증
    if (!['male', 'female', 'other'].includes(data.gender)) {
      errors.gender = 'Invalid gender specified';
    }
  
    // 직업 검증
    if (!data.occupation || data.occupation.trim().length === 0) {
      errors.occupation = 'Occupation is required';
    }
  
    return {
      errors,
      isValid: Object.keys(errors).length === 0
    };
  };
  
  // 분석 결과 데이터 검증
  const validateAnalysisInput = (data) => {
    const errors = {};
  
    // face_analysis 검증
    if (!data.face_analysis || !data.face_analysis.emotion) {
      errors.face_analysis = 'Face analysis data is required';
    }
    if (!data.face_analysis?.score || data.face_analysis.score < 0 || data.face_analysis.score > 1) {
      errors.face_analysis_score = 'Face analysis score must be between 0 and 1';
    }
  
    // voice_analysis 검증
    if (!data.voice_analysis?.stress_level || !data.voice_analysis?.confidence) {
      errors.voice_analysis = 'Voice analysis data is incomplete';
    }
  
    // result 검증
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