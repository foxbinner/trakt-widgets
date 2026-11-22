const express = require('express');
const createError = require('http-errors');
const controller = require('../controllers/controller');
const { renderCard } = require('../lib/canvas-renderer');
const { renderHome } = require('../views/home');

const router = express.Router();

const layouts = ['watched'];

// Parses "watched", "watched_half" or "watched_261" into a base layout and scale.
const parseLayout = layout => {
  if (layout.endsWith('_half')) return { base: layout.slice(0, -5), scale: 0.5 };
  if (layout.endsWith('_261')) return { base: layout.slice(0, -4), scale: 261 / 846 };
  return { base: layout, scale: 1 };
};

const sendCard = async (req, res, next, base, scale) => {
  try {
    const data = await controller[base](req, next);
    if (!data) return;

    const { buffer, mime } = await renderCard({ data, format: 'png', scale });

    res.set('Cache-Control', 'public, max-age=0, s-maxage=300, stale-while-revalidate=600');
    res.set('Content-Type', mime);
    res.send(buffer);
  } catch (err) {
    next(err);
  }
};

// Home page
router.get('/', (req, res) => {
  res.set('Content-Type', 'text/html');
  res.send(renderHome());
});

// /:slug/:layout.png returns a PNG image
router.get('/:slug/:layout.:ext(png)', (req, res, next) => {
  const { base, scale } = parseLayout(req.params.layout);
  if (!layouts.includes(base)) return next(createError(400, 'Layout not found'));
  sendCard(req, res, next, base, scale);
});

// /:slug/:layout returns an image for image/* requests, 404 otherwise
router.get('/:slug/:layout', (req, res, next) => {
  const { base, scale } = parseLayout(req.params.layout);
  if (!layouts.includes(base)) return next(createError(400, 'Layout not found'));
  res.format({
    'image/*': () => sendCard(req, res, next, base, scale),
    default: () => next(createError(404, 'Not found')),
  });
});

module.exports = router;
