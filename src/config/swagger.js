const swaggerJsdoc = require('swagger-jsdoc');
const swaggerUi = require('swagger-ui-express');

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
  },
  apis: [
    './src/routes/*.js',     // 라우트 파일들
    './src/models/*.js'      // 모델 파일들 (스키마 문서화를 위해)
  ],
};

const specs = swaggerJsdoc(options);

module.exports = { specs, swaggerUi };