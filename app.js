require('dotenv').config();
const express = require('express');
const createError = require('http-errors');
const path = require('path');

const routers = require('./src/routes');
const { renderErrorPage } = require('./src/views/error-page');
const { renderErrorSvg } = require('./src/views/error-svg');

const PORT = process.env.PORT || 3000;
const app = express();

app.use(express.static(path.join(__dirname, 'public')));

app.use('/', routers);

app.use((req, res, next) => {
  next(createError(404, 'Page not found'));
});

app.use((err, req, res, next) => {
  err.status = err.status || 500;
  err.message = err.message || 'Internal Error';

  res.status(err.status);
  res.format({
    html: () => {
      res.set('Content-Type', 'text/html');
      res.send(renderErrorPage({ error: err }));
    },
    'image/*': () => {
      res.set('Content-Type', 'image/svg+xml');
      res.send(renderErrorSvg({ error: err }));
    },
    default: () => {
      res.send(`${err.status} | ${err.message}`);
    },
  });
});

app.listen(PORT, () => {
  console.log(`App running on PORT ${PORT}`);
});

module.exports = app;
