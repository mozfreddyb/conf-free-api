/*! This Source Code Form is subject to the terms of the Mozilla Public
* License, v. 2.0. If a copy of the MPL was not distributed with this
* file, You can obtain one at http://mozilla.org/MPL/2.0/.
*/

/* jshint strict: true, node: true */

'use strict';

var ical = require('ical'),
    util = require('util'),
    express = require('express'),
    moment = require('moment'),
    _ = require('lodash-node'),
    config = require('config'),
    EventEmitter = require('events').EventEmitter;

var debug = require('debug')('conf-free-api');

moment.locale('en', config.get('moment.en'));

// how often to ping the calendar server in min
var CALENDAR_INTERVAL = config.get('ics.calender-interval');

function FreeBusy() {
  FreeBusy.init.call(this);
}

FreeBusy.prototype.formatURL = function formatURL (url, room, now) {
  return util.format(url, encodeURIComponent(room.email), now.format("YYYYMMDD"));
};

FreeBusy.init = function() {
  this.url = config.get('ics.url');
  this.rooms = config.get('ics.rooms');

  this.getAll();
  // run every CALENDAR_INTERVAL min on the CALENDAR_INTERVAL
  setInterval(this.getAll, CALENDAR_INTERVAL * 1000);
};

FreeBusy.prototype.free = function free() {
  return _.filter(this.rooms, function (room) {
    return room.current === null;
  });
};

FreeBusy.prototype.busy = function busy() {
  return _.filter(this.rooms, function (room) {
    return room.current !== null;
  });
};

FreeBusy.prototype.get = function get(room) {
  var now = moment();
  var url = this.formatURL(this.url, room, now);
  debug(now.toDate(), url);

  var findToday = function(fb) {
    var eod = now.clone().endOf('day');
    // starts later but today
    // || OR ||
    // started before now but ends after now (runs through)
    return (moment(fb.start).isBetween(now, eod) ||
            moment(fb.end).isBetween(now, eod));
  };
  // this function relies on an array sorted by start time
  var findNext = function(fb) {
    return !now.isBetween(fb.start, fb.end);
  };
  var findNow = function(fb) {
    return now.isBetween(fb.start, fb.end);
  };
  var sortStartTime = function(fb) {
    return moment(fb.start).valueOf();
  };

  ical.fromURL(url, {},
    function(err, data) {
      if (err) { console.error(err); return err; }

      // debug(JSON.stringify(data,null," "));

      // strip down the information to lists of Free Busy arrays
      var fbTypes = _.where(data, {type : 'VFREEBUSY'});
      // debug('fbTypes', fbTypes);

      // Merge the arrays and convert the undefined items into empty arrays
      //  Filter to only the data relevant to today
      room.freebusy = _.sortBy(_.filter(fbTypes, findToday), sortStartTime);
      debug('room.freebusy', room.freebusy);

      room.next = _.find(room.freebusy, findNext) || null;
      debug('room.next', room.next);

      room.current = _.find(room.freebusy, findNow) || null;
      debug('room.current', room.current);
    },
    this);
};
FreeBusy.prototype.getAll = function getAll() {
  _.each(this.rooms, this.get, this);
};


// EXPRESS

var app = module.exports = express();
var ffbb = new FreeBusy();

// JSON API

app.get('/api/rooms', function(req, res, next){
  res.send({ rooms : ffbb.rooms });
});

app.get('/api/rooms/free', function(req, res, next){
  res.send({ rooms : ffbb.free() });
});

app.get('/api/rooms/busy', function(req, res, next){
  res.send({ rooms : ffbb.busy() });
});

if (!module.parent) {
  var server = app.listen(Number(process.env.PORT || 5000), function() {
    console.log('NODE_ENV=%s http://%s:%d', app.settings.env, server.address().address, server.address().port);
  });
}
