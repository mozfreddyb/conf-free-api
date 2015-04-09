# conf-free

A Node.js and Express.js backend designed to query you calendaring server and deliver that data in yummy, yummy JSON to a client side application of your choice.

## Using

  npm install --save gcal-conf-free-api

```javascript
var app = require('gcal-conf-free-api').app;

app.use('/', require('express').static(path.join(__dirname, 'public')));

var server = app.listen(Number(process.env.PORT || config.get('ics.port')), function() {
  console.log('NODE_ENV=%s http://%s:%d', app.settings.env, server.address().address, server.address().port);
});
```

## Getting Started

    npm install
    npm start
    npm test

## Debugging

  DEBUG="gcal-conf-free-api" npm start

## API

* All Rooms and related Free / Busy information
  * http://0.0.0.0:5000/api/rooms
* Only rooms currently busy
  * http://0.0.0.0:5000/api/rooms/busy
* Only rooms currently free
  * http://0.0.0.0:5000/api/rooms/free
