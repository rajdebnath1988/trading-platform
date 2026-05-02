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

const AUTH_URL      = process.env.AUTH_SERVICE_URL      || 'http://auth-service:3001';
const MARKET_URL    = process.env.MARKET_SERVICE_URL    || 'http://market-data-service:8000';
const ORDER_URL     = process.env.ORDER_SERVICE_URL     || 'http://order-service:3003';
const PORTFOLIO_URL = process.env.PORTFOLIO_SERVICE_URL || 'http://portfolio-service:3004';

// Global rate limiter
app.use(rateLimit({ windowMs: 15 * 60 * 1000, max: 300, standardHeaders: true }));

// Auth middleware
const requireAuth = (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer '))
    return res.status(401).json({ error: 'Authorization header required' });
  try {
    req.user = jwt.verify(authHeader.split(' ')[1], process.env.JWT_SECRET, { issuer: 'tradex-auth' });
    next();
  } catch {
    res.status(401).json({ error: 'Invalid or expired token' });
  }
};

const proxyOpts = (target, pathRewrite) => ({
  target,
  changeOrigin: true,
  pathRewrite,
  on: {
    error: (err, req, res) => {
      console.error(`Proxy error to ${target}:`, err.message);
      if (!res.headersSent) res.status(503).json({ error: 'Service temporarily unavailable' });
    },
  },
});

// Routes — public
app.use('/api/auth',   createProxyMiddleware(proxyOpts(AUTH_URL,   { '^/api/auth':   '/auth'   })));
app.use('/api/market', createProxyMiddleware({ ...proxyOpts(MARKET_URL, { '^/api/market': '/market' }), ws: true }));

// Routes — protected
app.use('/api/orders',    requireAuth, createProxyMiddleware(proxyOpts(ORDER_URL,     { '^/api/orders':    '/orders'    })));
app.use('/api/portfolio', requireAuth, createProxyMiddleware(proxyOpts(PORTFOLIO_URL, { '^/api/portfolio': '/portfolio' })));

app.get('/health', (req, res) => res.json({
  status: 'ok',
  service: 'api-gateway',
  version: process.env.VERSION || '1.0.0',
  uptime: Math.floor(process.uptime()),
}));

app.use('*', (req, res) => res.status(404).json({ error: `Route ${req.originalUrl} not found` }));

const PORT = process.env.PORT || 3000;
app.listen(PORT, '0.0.0.0', () => console.log(`API Gateway on port ${PORT}`));
process.on('SIGTERM', () => { console.log('SIGTERM — shutting down'); process.exit(0); });
