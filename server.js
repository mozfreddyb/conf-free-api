/*! This Source Code Form is subject to the terms of the Mozilla Public
* License, v. 2.0. If a copy of the MPL was not distributed with this
* file, You can obtain one at http://mozilla.org/MPL/2.0/.
*/

/* jshint strict: true, node: true */

'use strict';

var ical = require('ical'),
    util = require('util'),
    express = require('express'),
    moment = require('moment-range'),
    _ = require('lodash-node'),
    config = require('config'),
    EventEmitter = require('events').EventEmitter;

var debug = require('debug')('conf-free-api');

moment.locale('en', config.get('moment.en'));

// how often to ping the calendar server in min 
var CALENDAR_INTERVAL = config.get('ics.calender-interval');

_.mixin({
  isFree : function isFree (ev) {
    return (ev.type === "FREE");
  },
  isBusy : function isBusy (ev) {
    return (ev.type === "BUSY");
  }
});

function FreeBusy() {
  FreeBusy.init.call(this);
}

FreeBusy.prototype.formatURL = undefined;

FreeBusy.prototype.formatURL = function formatURL (url, room, now) {
  return util.format(url, encodeURIComponent(room.email), now.format("YYYYMMDD"));
};

FreeBusy.init = function() {
  this.url = config.get('ics.url');
  this.rooms = config.get('ics.rooms');

  if (!this.formatURL) {
    this.formatURL = function (url, room, now) { return url; };
  }

  this.getAll();
  // run every CALENDAR_INTERVAL min on the CALENDAR_INTERVAL
  setInterval(this.getAll, CALENDAR_INTERVAL * 1000);
};

FreeBusy.prototype.free = function free() {
  var now = moment();
  return _.filter(this.rooms, function (room) {
    return _.every(room.freebusy, function (fb) {
      var start = moment(fb.start);
      var range = moment().range(start, moment(fb.end));
      // it is marked FREE, this is very uncommon for most calendars
      // || OR ||
      // check that our next busy event is later
      return (_.isFree(fb) && range.contains(now)) ||
             (_.isBusy(fb) && start.isAfter(now));
    });
  });
};
FreeBusy.prototype.busy = function busy() {
  var now = moment();
  return _.filter(this.rooms, function (room) {
    return _.some(room.freebusy, function (fb) {
      var range = moment().range(moment(fb.start), moment(fb.end));
      return _.isBusy(fb) && range.contains(now);
    });
  });
};

FreeBusy.prototype.get = function get(room) {
  var now = moment();
  debug(now.toDate());
  var url = this.formatURL(this.url, room, now);
  debug(url);
  var todayFilter = function(fb) {
    var eod = now.clone().endOf('day');
    var fbRange = moment().range(fb.start, fb.end);
    var dayRange = moment().range(now, eod);
    // starts later but today
    // || OR ||
    // started before now but ends after now (runs through)
    return fbRange.overlaps(dayRange);
  };
  ical.fromURL(url, {},
    function(err, data) {
      if (err) { console.error(err); return err; }
      if (debug.enabled) { console.dir(data); }

      // strip down the information to lists of Free Busy arrays
      var fbTypes = _.where(data, {type : 'VFREEBUSY'});
      if (debug.enabled) { console.log('fbTypes', fbTypes); }

      var fbLists = _.pluck(fbTypes, 'freebusy');
      if (debug.enabled) { console.log('fbLists', fbLists); }

      var fbCompact = _.compact(data);
      if (debug.enabled) { console.log('fbCompact', fbCompact); }

      var fbFlatten = _.flatten(fbCompact);
      if (debug.enabled) { console.log('fbFlatten', fbFlatten); }

      // Merge the arrays and convert the undefined items into empty arrays
      //  Filter to only the data relevant to today
      room.freebusy = _.filter(fbFlatten, todayFilter);
      room.next = _.find(room.freebusy, todayFilter) || null;
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
