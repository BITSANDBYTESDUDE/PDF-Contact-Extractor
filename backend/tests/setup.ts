import path from 'node:path';
process.env.NODE_ENV = 'test';
process.env.UPLOAD_DIR = path.resolve('backend/uploads', `test-${process.pid}`);
process.env.FRONTEND_URL = 'http://localhost:3000';
