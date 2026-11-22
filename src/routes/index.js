const express = require('express');
const createError = require('http-errors');
const controller = require('../controllers/controller');
const { renderCard, renderErrorCard } = require('../lib/canvas-renderer');
const { renderHome } = require('../views/home');

const router = express.Router();

const layouts = ['watched'];

// Cards are served at 752x423 (half of the 1504x846 drawing size).
// "watched_half" is kept as an alias so older embeds still work.
const parseLayout = layout => {
  if (layout.endsWith('_half')) return { base: layout.slice(0, -5), scale: 0.5 };
  if (layout.endsWith('_261')) return { base: layout.slice(0, -4), scale: 261 / 846 };
  return { base: layout, scale: 0.5 };
};

// Short, readable reason for the error card.
const errorMessage = err => {
  const text = String(err?.message || '');
  if (err && err.status === 401) return 'This profile is private';
  if (err?.message === 'No watch history found') return 'No watch history found';
  if (text.includes('404') || (err && err.status === 404)) return 'Trakt user not found';
  if (err && err.status === 400) return 'Card type not found';
  return "Couldn't load this card";
};

const sendImage = (res, { buffer, mime }, cache) => {
  res.set('Cache-Control', cache);
  res.set('Content-Type', mime);
  res.send(buffer);
};

// Renders the error card instead of passing the error on. Sent as 200 so
// image proxies (GitHub, forums) still display it; cached only briefly.
const sendErrorCard = async (req, res, next, err, scale) => {
  try {
    const image = await renderErrorCard({
      message: errorMessage(err),
      username: req.params.slug,
      scale,
    });
    sendImage(res, image, 'public, max-age=0, s-maxage=60');
  } catch (e) {
    next(e);
  }
};

const sendCard = async (req, res, next, base, scale) => {
  if (!layouts.includes(base)) {
    return sendErrorCard(req, res, next, createError(400, 'Layout not found'), scale);
  }
  let failure = null;
  try {
    // The controller reports failures through next(); capture them here.
    const data = await controller[base](req, err => {
      failure = err;
    });
    if (failure || !data) return sendErrorCard(req, res, next, failure, scale);
    if (!data.element) {
      return sendErrorCard(req, res, next, createError(404, 'No watch history found'), scale);
    }

    const image = await renderCard({ data, scale });
    sendImage(res, image, 'public, max-age=0, s-maxage=300, stale-while-revalidate=600');
  } catch (err) {
    sendErrorCard(req, res, next, err, scale);
  }
};

// Home page
router.get('/', (req, res) => {
  res.set('Content-Type', 'text/html');
  res.send(renderHome());
});

// /:slug/:layout.jpg returns the card as JPEG
router.get('/:slug/:layout.:ext(jpg)', (req, res, next) => {
  const { base, scale } = parseLayout(req.params.layout);
  sendCard(req, res, next, base, scale);
});

// /:slug/:layout returns an image for image/* requests, 404 otherwise
router.get('/:slug/:layout', (req, res, next) => {
  const { base, scale } = parseLayout(req.params.layout);
  res.format({
    'image/*': () => sendCard(req, res, next, base, scale),
    default: () => next(createError(404, 'Not found')),
  });
});

module.exports = router;
