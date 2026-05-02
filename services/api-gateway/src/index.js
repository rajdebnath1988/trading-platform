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

const proxy = (target, pathRewrite, ws = false) => createProxyMiddleware({
  target, changeOrigin: true, ws, pathRewrite,
  on: { error: (e, req, res) => { if (!res.headersSent) res.status(503).json({ error: 'Service unavailable' }); } }
});

const requireAuth = (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'Authorization required' });
  try { req.user = jwt.verify(token, process.env.JWT_SECRET, { issuer: 'tradex-auth' }); next(); }
  catch { res.status(401).json({ error: 'Invalid or expired token' }); }
};

app.use('/api/auth',      proxy(AUTH_URL,  { '^/api/auth':      '/auth'      }));
app.use('/api/market',    proxy(MKT_URL,   { '^/api/market':    '/market'    }, true));
app.use('/api/orders',    requireAuth, proxy(ORD_URL,  { '^/api/orders':    '/orders'    }));
app.use('/api/portfolio', requireAuth, proxy(PORT_URL, { '^/api/portfolio': '/portfolio' }));

app.get('/health', (req, res) => res.json({
  status: 'ok', service: 'api-gateway',
  version: process.env.VERSION || '1.0.0',
  uptime: Math.floor(process.uptime())
}));
app.use('*', (req, res) => res.status(404).json({ error: `Route ${req.originalUrl} not found` }));

app.listen(process.env.PORT || 3000, '0.0.0.0', () => console.log('API Gateway on 3000'));
process.on('SIGTERM', () => process.exit(0));
