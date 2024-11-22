const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const helmet = require('helmet');
require('dotenv').config();

const connectDB = require('./src/config/db');
const userRoutes = require('./src/routes/userRoutes');
const analysisRoutes = require('./src/routes/analysisRoutes');

const app = express();

// 미들웨어
app.use(cors());
app.use(helmet());
app.use(express.json());

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

// 404 에러 핸들링
app.use((req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

// 전역 에러 핸들링
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Something went wrong!' });
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});