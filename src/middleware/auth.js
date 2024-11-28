const jwt = require('jsonwebtoken');

/**
 * @swagger
 * components:
 *   securitySchemes:
 *     bearerAuth:
 *       type: http
 *       scheme: bearer
 *       bearerFormat: JWT
 *   responses:
 *     UnauthorizedError:
 *       description: 인증에 실패했습니다
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               status:
 *                 type: string
 *                 example: "error"
 *               code:
 *                 type: string
 *                 example: "AUTH_ERROR"
 *               message:
 *                 type: string
 *                 example: "Authentication required"
 *               details:
 *                 type: object
 *                 nullable: true
 */

// 표준화된 에러 응답 생성 함수
const createAuthError = (code, message, details = null) => ({
  status: 'error',
  code: `AUTH_${code}`,
  message,
  details
});

// JWT 토큰 형식 검증 함수
const isValidJWTFormat = (token) => {
  const jwtRegex = /^[A-Za-z0-9-_=]+\.[A-Za-z0-9-_=]+\.[A-Za-z0-9-_.+/=]*$/;
  return jwtRegex.test(token);
};

/**
 * 인증 미들웨어
 * @param {Object} options - 미들웨어 설정 옵션
 * @param {boolean} options.requireValidToken - 유효한 토큰이 반드시 필요한지 여부 (기본값: true)
 * @param {number} options.clockTolerance - 토큰 만료 시간 허용 오차(초) (기본값: 0)
 */
const auth = (options = {}) => {
  const {
    requireValidToken = true,
    clockTolerance = 0
  } = options;

  return async (req, res, next) => {
    try {
      const authHeader = req.header('Authorization');
      const token = authHeader?.replace('Bearer ', '');

      // 토큰 존재 여부 확인
      if (!token) {
        return res.status(401).json(
          createAuthError('MISSING_TOKEN', 'Authentication token is required')
        );
      }

      // 토큰 형식 검증
      if (!isValidJWTFormat(token)) {
        return res.status(401).json(
          createAuthError('INVALID_FORMAT', 'Invalid token format')
        );
      }

      try {
        // 토큰 검증 및 디코딩
        const decoded = jwt.verify(token, process.env.JWT_SECRET, {
          clockTolerance: clockTolerance,
          algorithms: ['HS256'] // 허용할 알고리즘 명시적 지정
        });

        // 필수 클레임 검증
        if (!decoded.user_id || !decoded.email) {
          throw new Error('Missing required claims');
        }

        // 토큰 만료 시간 여유 확인 (5분 미만 남은 경우 갱신 권장)
        const expirationTime = decoded.exp * 1000; // JWT exp는 초 단위
        const currentTime = Date.now();
        const timeToExpire = expirationTime - currentTime;
        
        if (timeToExpire < 300000) { // 5분 = 300000ms
          res.set('X-Token-Expire-Soon', 'true');
        }

        req.user = {
          user_id: decoded.user_id,
          email: decoded.email,
          exp: decoded.exp
        };

        next();
      } catch (jwtError) {
        if (jwtError.name === 'TokenExpiredError') {
          return res.status(401).json(
            createAuthError('TOKEN_EXPIRED', 'Token has expired')
          );
        }
        if (jwtError.name === 'JsonWebTokenError') {
          return res.status(401).json(
            createAuthError('INVALID_TOKEN', 'Invalid token', { detail: jwtError.message })
          );
        }
        throw jwtError; // 예상치 못한 JWT 에러는 일반 에러로 처리
      }
    } catch (error) {
      console.error('Auth middleware error:', error);
      res.status(500).json(
        createAuthError('INTERNAL_ERROR', 'Internal authentication error')
      );
    }
  };
};

module.exports = auth;