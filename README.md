# conf-free

A Node.js and Express.js backend designed to query you calendaring server and deliver that data in yummy, yummy JSON to a client side application of your choice.

## Getting Started

    npm install
    npm start
    npm test

## API

* All Rooms and related Free / Busy information
  * http://0.0.0.0:5000/api/rooms
* Only rooms currently busy
  * http://0.0.0.0:5000/api/rooms/busy
* Only rooms currently free
  * http://0.0.0.0:5000/api/rooms/free

( NOTE: API endpoints for busy and free times includes a default 5 min start time 'fuzz' where a room will be included if it is about to become free or busy )
