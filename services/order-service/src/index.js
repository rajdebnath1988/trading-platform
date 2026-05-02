'use strict';
const express = require('express');
const { Pool } = require('pg');
const jwt = require('jsonwebtoken');

const app = express();
app.use(express.json({ limit: '10kb' }));

const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 10 });

const initDB = async () => {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS orders (
      id         SERIAL PRIMARY KEY,
      user_id    INTEGER NOT NULL,
      symbol     VARCHAR(20) NOT NULL,
      type       VARCHAR(4) NOT NULL CHECK (type IN ('BUY','SELL')),
      quantity   DECIMAL(12,4) NOT NULL CHECK (quantity > 0),
      price      DECIMAL(14,4) NOT NULL CHECK (price > 0),
      status     VARCHAR(20) NOT NULL DEFAULT 'FILLED',
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    )
  `);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_orders_user ON orders(user_id)`);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_orders_symbol ON orders(symbol, created_at DESC)`);
  console.log('Order DB initialized');
};
pool.connect().then(() => initDB()).catch(e => {
  console.error('DB error, retrying...', e.message);
  setTimeout(() => pool.connect().then(() => initDB()).catch(console.error), 5000);
});

const requireAuth = (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'Unauthorized' });
  try { req.user = jwt.verify(token, process.env.JWT_SECRET, { issuer: 'tradex-auth' }); next(); }
  catch { res.status(401).json({ error: 'Invalid token' }); }
};

// POST /orders — place a new order
app.post('/orders', requireAuth, async (req, res) => {
  const { symbol, type, quantity, price } = req.body;
  if (!symbol || !type || !quantity || !price)
    return res.status(400).json({ error: 'symbol, type, quantity, price are required' });
  if (!['BUY','SELL'].includes(type))
    return res.status(400).json({ error: 'type must be BUY or SELL' });
  if (quantity <= 0 || price <= 0)
    return res.status(400).json({ error: 'quantity and price must be positive' });
  try {
    const result = await pool.query(
      `INSERT INTO orders (user_id, symbol, type, quantity, price)
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [req.user.userId, symbol.toUpperCase(), type, parseFloat(quantity), parseFloat(price)]
    );
    const order = result.rows[0];
    order.total = parseFloat(order.quantity) * parseFloat(order.price);
    res.status(201).json(order);
  } catch (err) {
    console.error('Order error:', err.message);
    res.status(500).json({ error: 'Failed to place order' });
  }
});

// GET /orders — list user orders
app.get('/orders', requireAuth, async (req, res) => {
  const limit = Math.min(parseInt(req.query.limit) || 50, 100);
  const offset = parseInt(req.query.offset) || 0;
  let query = 'SELECT * FROM orders WHERE user_id = $1';
  const params = [req.user.userId];
  if (req.query.symbol)
    query += ` AND symbol = $${params.push(req.query.symbol.toUpperCase())}`;
  query += ` ORDER BY created_at DESC LIMIT $${params.push(limit)} OFFSET $${params.push(offset)}`;
  try {
    const result = await pool.query(query, params);
    const orders = result.rows.map(o => ({ ...o, total: parseFloat(o.quantity) * parseFloat(o.price) }));
    res.json({ orders, count: result.rowCount });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch orders' });
  }
});

// GET /orders/:id — single order
app.get('/orders/:id', requireAuth, async (req, res) => {
  const result = await pool.query(
    'SELECT * FROM orders WHERE id = $1 AND user_id = $2',
    [parseInt(req.params.id), req.user.userId]
  );
  if (!result.rows[0]) return res.status(404).json({ error: 'Order not found' });
  const o = result.rows[0];
  res.json({ ...o, total: parseFloat(o.quantity) * parseFloat(o.price) });
});

app.get('/health', async (req, res) => {
  try {
    await pool.query('SELECT 1');
    res.json({ status: 'ok', service: 'order-service', version: process.env.VERSION || '1.0.0' });
  } catch {
    res.status(503).json({ status: 'error', service: 'order-service' });
  }
});

app.listen(process.env.PORT || 3003, '0.0.0.0', () => console.log('Order service ready'));
process.on('SIGTERM', () => { pool.end(() => process.exit(0)); });
