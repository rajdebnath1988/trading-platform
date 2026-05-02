'use strict';
const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { Pool } = require('pg');
const rateLimit = require('express-rate-limit');

const app = express();
app.use(express.json({ limit: '10kb' }));
app.set('trust proxy', 1);

const limiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 20, standardHeaders: true });
app.use('/auth/', limiter);

const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 10 });

const initDB = async () => {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id            SERIAL PRIMARY KEY,
      email         VARCHAR(255) UNIQUE NOT NULL,
      password_hash VARCHAR(255) NOT NULL,
      full_name     VARCHAR(255),
      balance       DECIMAL(15,4) DEFAULT 100000.00,
      created_at    TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    )`);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_users_email ON users(email)`);
  console.log('Auth DB ready');
};
pool.connect().then(() => initDB()).catch(e => setTimeout(() => pool.connect().then(() => initDB()).catch(console.error), 5000));

app.post('/auth/register', async (req, res) => {
  const { email, password, fullName } = req.body;
  if (!email || !password) return res.status(400).json({ error: 'Email and password required' });
  if (password.length < 8) return res.status(400).json({ error: 'Password min 8 chars' });
  try {
    const hash = await bcrypt.hash(password, 12);
    const r = await pool.query(
      `INSERT INTO users (email,password_hash,full_name) VALUES ($1,$2,$3) RETURNING id,email,full_name,balance`,
      [email.toLowerCase().trim(), hash, fullName || email.split('@')[0]]
    );
    const user = r.rows[0];
    const token = jwt.sign({ userId: user.id, email: user.email }, process.env.JWT_SECRET, { expiresIn: '24h', issuer: 'tradex-auth' });
    res.status(201).json({ token, user });
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ error: 'Email already registered' });
    console.error(err.message);
    res.status(500).json({ error: 'Registration failed' });
  }
});

app.post('/auth/login', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ error: 'Email and password required' });
  try {
    const r = await pool.query('SELECT * FROM users WHERE email=$1', [email.toLowerCase().trim()]);
    const user = r.rows[0];
    if (!user || !(await bcrypt.compare(password, user.password_hash)))
      return res.status(401).json({ error: 'Invalid credentials' });
    const token = jwt.sign({ userId: user.id, email: user.email }, process.env.JWT_SECRET, { expiresIn: '24h', issuer: 'tradex-auth' });
    res.json({ token, user: { id: user.id, email: user.email, full_name: user.full_name, balance: parseFloat(user.balance) } });
  } catch (err) { console.error(err.message); res.status(500).json({ error: 'Login failed' }); }
});

app.get('/auth/me', async (req, res) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'Unauthorized' });
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET, { issuer: 'tradex-auth' });
    const r = await pool.query('SELECT id,email,full_name,balance,created_at FROM users WHERE id=$1', [decoded.userId]);
    if (!r.rows[0]) return res.status(404).json({ error: 'User not found' });
    res.json(r.rows[0]);
  } catch { res.status(401).json({ error: 'Invalid token' }); }
});

app.get('/health', async (req, res) => {
  try { await pool.query('SELECT 1'); res.json({ status: 'ok', service: 'auth-service', version: process.env.VERSION || '1.0.0' }); }
  catch { res.status(503).json({ status: 'error', service: 'auth-service' }); }
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, '0.0.0.0', () => console.log(`Auth service on ${PORT}`));
process.on('SIGTERM', () => pool.end(() => process.exit(0)));
