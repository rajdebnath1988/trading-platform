'use strict';
const express = require('express');
const { createProxyMiddleware } = require('http-proxy-middleware');
const rateLimit = require('express-rate-limit');
const cors = require('cors');
const morgan = require('morgan');
const jwt = require('jsonwebtoken');

const app = express();
app.set('trust proxy', 1);
app.use(cors({ origin: '*', methods: ['GET','POST','PUT','DELETE','OPTIONS'] }));
app.use(morgan('combined'));
app.use(rateLimit({ windowMs: 15 * 60 * 1000, max: 300, standardHeaders: true }));

const AUTH_URL  = process.env.AUTH_SERVICE_URL      || 'http://auth-service:3001';
const MKT_URL   = process.env.MARKET_SERVICE_URL    || 'http://market-data-service:8000';
const ORD_URL   = process.env.ORDER_SERVICE_URL     || 'http://order-service:3003';
const PORT_URL  = process.env.PORTFOLIO_SERVICE_URL || 'http://portfolio-service:3004';

const requireAuth = (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'Authorization required' });
  try { req.user = jwt.verify(token, process.env.JWT_SECRET, { issuer: 'tradex-auth' }); next(); }
  catch { res.status(401).json({ error: 'Invalid or expired token' }); }
};

app.use('/api/auth', createProxyMiddleware({
  target: AUTH_URL, changeOrigin: true,
  pathRewrite: { '^/api/auth': '/auth' },
  on: { error: (e, req, res) => res.status(503).json({ error: 'Auth service unavailable' }) }
}));

app.use('/api/market', createProxyMiddleware({
  target: MKT_URL, changeOrigin: true, ws: true,
  pathRewrite: { '^/api/market': '/market' },
  on: { error: (e, req, res) => res.status(503).json({ error: 'Market service unavailable' }) }
}));

app.use('/api/orders', requireAuth, createProxyMiddleware({
  target: ORD_URL, changeOrigin: true,
  pathRewrite: { '^/api/orders': '/orders' },
  on: { error: (e, req, res) => res.status(503).json({ error: 'Order service unavailable' }) }
}));

app.use('/api/portfolio', requireAuth, createProxyMiddleware({
  target: PORT_URL, changeOrigin: true,
  pathRewrite: { '^/api/portfolio': '/portfolio' },
  on: { error: (e, req, res) => res.status(503).json({ error: 'Portfolio service unavailable' }) }
}));

app.get('/health', (req, res) => res.json({
  status: 'ok', service: 'api-gateway',
  version: process.env.VERSION || '1.0.0',
  uptime: Math.floor(process.uptime())
}));

app.use('*', (req, res) => res.status(404).json({ error: `Route ${req.originalUrl} not found` }));

app.listen(process.env.PORT || 3000, '0.0.0.0', () => console.log('API Gateway on 3000'));
process.on('SIGTERM', () => process.exit(0));
