const swaggerJsdoc = require('swagger-jsdoc');
const swaggerUi = require('swagger-ui-express');

/**
 * @swagger
 * components:
 *   schemas:
 *     Error:
 *       type: object
 *       properties:
 *         error:
 *           type: string
 *           description: 에러 메시지
 *   responses:
 *     NotFound:
 *       description: 요청한 리소스를 찾을 수 없습니다
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/Error'
 *     ServerError:
 *       description: 서버 내부 에러
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/Error'
 */

const options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'Clearmind API Documentation',
      version: '1.0.0',
      description: 'API documentation for Clearmind server',
    },
    servers: [
      {
        url: 'https://clearmind-server.onrender.com',
        description: '운영 서버',
      },
      {
        url: 'http://localhost:10000',
        description: '개발 서버',
      },
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
          description: 'JWT 토큰을 입력하세요'
        }
      },
      responses: {
        UnauthorizedError: {
          description: '인증에 실패했습니다',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  error: {
                    type: 'string',
                    example: 'Authentication required'
                  }
                }
              }
            }
          }
        },
        ValidationError: {
          description: '입력값 검증에 실패했습니다',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  errors: {
                    type: 'object',
                    properties: {
                      field: {
                        type: 'string',
                        description: '유효성 검사 실패 메시지'
                      }
                    }
                  }
                }
              }
            }
          }
        }
      }
    },
    tags: [
      {
        name: 'Users',
        description: '사용자 관리 API'
      },
      {
        name: 'Analysis',
        description: '분석 결과 관리 API'
      }
    ],
    security: [{
      bearerAuth: []
    }]
  },
  apis: [
    './src/routes/*.js',    // 모든 라우트 파일
    './src/models/*.js',    // 모든 모델 파일
    './src/middleware/*.js', // 미들웨어 파일
    './src/utils/*.js'      // 유틸리티 파일
  ],
};

const specs = swaggerJsdoc(options);

// Swagger UI 커스터마이즈 옵션
const swaggerOptions = {
  explorer: true,
  customCss: '.swagger-ui .topbar { display: none }',
  customSiteTitle: 'Clearmind API Documentation',
  customfavIcon: '/favicon.ico',
  swaggerOptions: {
    persistAuthorization: true,
    displayRequestDuration: true,
    docExpansion: 'list',
    filter: true,
    showCommonExtensions: true,
    syntaxHighlight: {
      activate: true,
      theme: 'monokai'
    }
  }
};

module.exports = { 
  specs, 
  swaggerUi,
  swaggerOptions
};