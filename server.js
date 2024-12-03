const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const helmet = require('helmet');
require('dotenv').config();

const connectDB = require('./src/config/db');
const { specs, swaggerUi, swaggerOptions } = require('./src/config/swagger');
const userRoutes = require('./src/routes/userRoutes');
const analysisRoutes = require('./src/routes/analysisRoutes');
const interviewRoutes = require('./src/routes/interviewRoutes'); // 추가
const resultRoutes = require('./src/routes/resultRoutes');

const app = express();

// 미들웨어
app.use(cors());
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      ...helmet.contentSecurityPolicy.getDefaultDirectives(),
      "img-src": ["'self'", "data:", "https:"],
      "script-src": ["'self'", "'unsafe-inline'", "'unsafe-eval'"],
      "style-src": ["'self'", "'unsafe-inline'"],
    },
  },
}));
app.use(express.json());

// Swagger UI 설정
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(specs, swaggerOptions));

// MongoDB 연결
connectDB()
  .then(() => console.log('Database connected successfully'))
  .catch(err => {
    console.error('Database connection error:', err);
    process.exit(1);
  });

// 라우트
app.use('/api/users', userRoutes);
app.use('/api/analysis', analysisRoutes);
app.use('/api/interviews', interviewRoutes); // 추가
app.use('/api/result', resultRoutes); // 추가

/**
 * @swagger
 * /404:
 *   get:
 *     description: 존재하지 않는 라우트에 대한 404 에러 응답
 *     responses:
 *       404:
 *         description: 라우트를 찾을 수 없습니다
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: Route not found
 */
app.use((req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

/**
 * @swagger
 * /error:
 *   get:
 *     description: 서버 내부 오류에 대한 500 에러 응답
 *     responses:
 *       500:
 *         description: 서버 내부 오류
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: Something went wrong!
 */
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Something went wrong!' });
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});