'use strict';
const express = require('express');
const { Pool } = require('pg');
const jwt = require('jsonwebtoken');

const app = express();
app.use(express.json({ limit: '10kb' }));

const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 10 });

const initDB = async () => {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS holdings (
      id        SERIAL PRIMARY KEY,
      user_id   INTEGER NOT NULL,
      symbol    VARCHAR(20) NOT NULL,
      quantity  DECIMAL(12,4) NOT NULL DEFAULT 0,
      avg_price DECIMAL(14,4) NOT NULL DEFAULT 0,
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      UNIQUE(user_id, symbol)
    )
  `);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS cash_balances (
      user_id    INTEGER PRIMARY KEY,
      balance    DECIMAL(16,4) NOT NULL DEFAULT 100000.00,
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    )
  `);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_holdings_user ON holdings(user_id)`);
  console.log('Portfolio DB initialized');
};
pool.connect().then(() => initDB()).catch(e => {
  setTimeout(() => pool.connect().then(() => initDB()).catch(console.error), 5000);
});

const requireAuth = (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'Unauthorized' });
  try { req.user = jwt.verify(token, process.env.JWT_SECRET, { issuer: 'tradex-auth' }); next(); }
  catch { res.status(401).json({ error: 'Invalid token' }); }
};

const ensureCashBalance = async (client, userId) => {
  const result = await client.query(
    `INSERT INTO cash_balances (user_id) VALUES ($1)
     ON CONFLICT (user_id) DO UPDATE SET user_id = EXCLUDED.user_id
     RETURNING balance`,
    [userId]
  );
  return parseFloat(result.rows[0].balance);
};

// GET /portfolio
app.get('/portfolio', requireAuth, async (req, res) => {
  const uid = req.user.userId;
  try {
    const [holdingsRes, cashRes] = await Promise.all([
      pool.query(`SELECT * FROM holdings WHERE user_id=$1 AND quantity>0 ORDER BY symbol`, [uid]),
      pool.query(
        `INSERT INTO cash_balances(user_id) VALUES($1)
         ON CONFLICT(user_id) DO UPDATE SET user_id=EXCLUDED.user_id
         RETURNING balance`,
        [uid]
      ),
    ]);
    const holdings = holdingsRes.rows.map(h => ({
      ...h,
      quantity:  parseFloat(h.quantity),
      avg_price: parseFloat(h.avg_price),
      value:     parseFloat(h.quantity) * parseFloat(h.avg_price),
    }));
    const cashBalance = parseFloat(cashRes.rows[0].balance);
    const portfolioValue = holdings.reduce((sum, h) => sum + h.value, 0);
    res.json({ holdings, cashBalance, portfolioValue, totalValue: portfolioValue + cashBalance });
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ error: 'Failed to fetch portfolio' });
  }
});

// POST /portfolio/trade — execute a trade (BUY or SELL)
app.post('/portfolio/trade', requireAuth, async (req, res) => {
  const { symbol, type, quantity, price } = req.body;
  if (!symbol || !type || !quantity || !price)
    return res.status(400).json({ error: 'symbol, type, quantity, price required' });
  if (!['BUY','SELL'].includes(type))
    return res.status(400).json({ error: 'type must be BUY or SELL' });

  const uid = req.user.userId;
  const qty = parseFloat(quantity);
  const px  = parseFloat(price);
  const total = qty * px;
  const sym = symbol.toUpperCase();
  const client = await pool.connect();

  try {
    await client.query('BEGIN');
    let balance = await ensureCashBalance(client, uid);

    if (type === 'BUY') {
      if (balance < total) throw new Error(`Insufficient funds. Need ₹${total.toFixed(2)}, have ₹${balance.toFixed(2)}`);
      balance -= total;
      await client.query(
        `INSERT INTO holdings (user_id, symbol, quantity, avg_price)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (user_id, symbol) DO UPDATE SET
           avg_price = (holdings.quantity * holdings.avg_price + $3 * $4) / (holdings.quantity + $3),
           quantity  = holdings.quantity + $3,
           updated_at = NOW()`,
        [uid, sym, qty, px]
      );
    } else {
      const h = await client.query(
        'SELECT quantity FROM holdings WHERE user_id=$1 AND symbol=$2 FOR UPDATE',
        [uid, sym]
      );
      const held = h.rows[0] ? parseFloat(h.rows[0].quantity) : 0;
      if (held < qty) throw new Error(`Insufficient holdings. Have ${held}, selling ${qty}`);
      balance += total;
      await client.query(
        `UPDATE holdings SET quantity = quantity - $3, updated_at = NOW()
         WHERE user_id=$1 AND symbol=$2`,
        [uid, sym, qty]
      );
    }

    await client.query(
      `UPDATE cash_balances SET balance=$2, updated_at=NOW() WHERE user_id=$1`,
      [uid, balance]
    );
    await client.query('COMMIT');
    res.json({ success: true, symbol: sym, type, quantity: qty, price: px, total, newBalance: balance });
  } catch (err) {
    await client.query('ROLLBACK');
    res.status(400).json({ error: err.message });
  } finally {
    client.release();
  }
});

app.get('/health', async (req, res) => {
  try {
    await pool.query('SELECT 1');
    res.json({ status: 'ok', service: 'portfolio-service', version: process.env.VERSION || '1.0.0' });
  } catch {
    res.status(503).json({ status: 'error', service: 'portfolio-service' });
  }
});

app.listen(process.env.PORT || 3004, '0.0.0.0', () => console.log('Portfolio service ready'));
process.on('SIGTERM', () => { pool.end(() => process.exit(0)); });
