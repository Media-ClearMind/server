const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const helmet = require('helmet');
require('dotenv').config();

const app = express();

// 미들웨어
app.use(cors());
app.use(helmet());
app.use(express.json());

// 테스트를 위한 간단한 스키마
const TestSchema = new mongoose.Schema({
  name: String,
  date: { type: Date, default: Date.now }
});

const Test = mongoose.model('Test', TestSchema);

// MongoDB 연결 설정 개선
mongoose.connect(process.env.MONGODB_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
})
.then(() => console.log('MongoDB Connected'))
.catch(err => {
  console.error('MongoDB Connection Error:', err);
  process.exit(1);
});

// MongoDB 연결 에러 이벤트 핸들링
mongoose.connection.on('error', err => {
  console.error('MongoDB connection error:', err);
});

mongoose.connection.on('disconnected', () => {
  console.log('MongoDB disconnected');
});

// 기본 라우트
app.get('/', (req, res) => {
  res.json({ message: 'Welcome to the API' });
});

// 테스트 라우트 추가
app.post('/api/test', async (req, res) => {
  try {
    const test = new Test({ name: 'test-item' });
    await test.save();
    res.json({ success: true, data: test });
  } catch (err) {
    console.error('DB Test Error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

app.get('/api/test', async (req, res) => {
  try {
    const tests = await Test.find();
    res.json({ success: true, data: tests });
  } catch (err) {
    console.error('DB Test Error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// 404 에러 핸들링 - 반드시 다른 라우트 정의 후에 위치해야 함
app.use((req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

// 전역 에러 핸들링
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Something went wrong!' });
});

// 예기치 않은 에러 핸들링
process.on('unhandledRejection', (err) => {
  console.error('Unhandled Rejection:', err);
  process.exit(1);
});

const PORT = process.env.PORT || 10000;
const server = app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

// 정상적인 서버 종료 처리
process.on('SIGTERM', () => {
  console.log('SIGTERM received. Shutting down gracefully');
  server.close(() => {
    console.log('Process terminated');
    mongoose.connection.close();
    process.exit(0);
  });
});