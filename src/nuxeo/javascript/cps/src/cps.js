/*

 Copyright (c) 2005 Nuxeo and Contributors.
 All Rights Reserved.

 This software is subject to the provisions of the Zope Public License,
 Version 2.1 (ZPL).  A copy of the ZPL should accompany this distribution.
 THIS SOFTWARE IS PROVIDED "AS IS" AND ANY AND ALL EXPRESS OR IMPLIED
 WARRANTIES ARE DISCLAIMED, INCLUDING, BUT NOT LIMITED TO, THE IMPLIED
 WARRANTIES OF TITLE, MERCHANTABILITY, AGAINST INFRINGEMENT, AND FITNESS
 FOR A PARTICULAR PURPOSE.

 CPS AJAX library

 Author: Tarek Ziadé <tz@nuxeo.com>


 This library implements common patterns, that can be used
 within CPS. A global CPS namespace is also provided,
 that will contains instances.

*/

/* CPS */
var CPS = {
  Version : '0.0.1',
  Effects: {}
}

/* helper */
function $$(className) {
  return document.getElementsByClassName(className, document);
}


/* event manager */
CPSEvents = Class.create();

CPSEvents.prototype = {
  /** initialize the observers
  * @constructor
  */
  initialize: function() {
    this.observers = false;
  },

  /** adds an observer, for the event "event_id".
  * the observer has an associated id wich is "observer_id"
  * when the event happens, "observer_listener" is a callable that gets triggered
  * @param {String} event_id
  * @param {String} observer_id
  * @param {Callable} observer_listener
  */
  observeEvent: function(event_id, observer_id, observer_listener) {
    if (!this.observers) this.observers = [];
    this.observers.push([event_id, observer_id, observer_listener]);
  },

  /** remove the observer "observer_id" for the event "event_id"
  * @param {String} event_id
  * @param {String} observer_id
  */
  stopObservingEvent: function(event_id, observer_id) {
    for (var i = 0; i < this.observers.length; i++) {
      if (this.observers[i][0] == event_id &&
          this.observers[i][1] == observer_id ) {
        this.observers[i][0] = null;
      }
    }
  },

  /** remove all observers
  */
  purgeObservers: function() {
    this.observers = false;
  },

  /** trigger the event "event_id"
  all observers for that event are called
  * @param {String} event_id
  */
  triggerEvent: function(event_id) {
    if (!this.observers)
      return;

    for (var i = 0; i < this.observers.length; i++) {
      if (this.observers[i][0] == event_id) {
        this.observers[i][2](event_id, this.observers[i][1]);
      }
    }
  }
}

CPS.Events = new CPSEvents();

/* Effects */

/* class transition */
CPS.Effects = {};

CPS.Effects._change = function(elements, toClass) {
  if (elements.length == 0) {
    return;
  }

  CPS.Events.triggerEvent('changeClass::'+toClass);

  for (var i = 0; i < elements.length; i++) {
    element = elements[i];
    if (element) {
      element.className = toClass;
    }
  }
}

CPS.Effects.addClassEffect = function(triggerId, fromClass, toClass) {
  CPS.setAction(triggerId, this.changeClass, fromClass, toClass);
}

CPS.Effects.changeClass = function(fromClass, toClass) {
  elements = $$(fromClass);
  if (elements.length > 0) {
    this._change(elements, toClass);
  }
  else {
    elements = $$(toClass);
    if (elements) {
      this._change(elements, fromClass);
    }
  }
}

CPS.Effects.hideClass = function(className) {
  elements = $$(className);
  for (var i = 0; i < elements.length; i++) {
    Effect.Fade(elements[i], {duration:0.5, queue:'end'});
  }
}

CPS.Effects.showClass = function(className) {
  elements = $$(className);
  for (var i = 0; i < elements.length; i++) {
    Effect.Appear(elements[i], {duration:0.5, queue:'end'});
  }
}

CPS.Effects._setCursorStyle = function(event) {
  element = event.target;
  if (navigator.appName == "Microsoft Internet Explorer")
    element.style.cursor = "hand";
  else
    element.style.cursor = "pointer";
}

CPS.Effects.setMouseOver = function(elementId) {
  element = $(elementId);
  if (!element) {
    return;
  }
  this.setCursorListener = this._setCursorStyle.bindAsEventListener(this);

  Event.observe(element, "mouseover", this.setCursorListener);
}

CPS.Effects.unSetMouseOver = function(elementId) {
  element = $(elementId);
  if (!element) {
    return;
  }
  Event.stopObserving(element, "mouseover", this.setCursorListener);
}

/* high level helpers */
CPS.setAction = function(elementId, callable) {

  element = $(elementId);
  if (!element) {
    return;
  }
  /* TODO see how to cleany pass params
  var argv = this.setAction.arguments;
  actionParams = $();

  for (var i = 2; i < argv.length; i++) {
    actionParams.push(argv[i]);
  }
  */
  CPS.Effects.setMouseOver(elementId);
  //callable = function() {callable(actionParams)};
  Event.observe(element, "click", callable);
}

CPS.unSetAction = function(elementId, callable) {
  element = $(elementId);
  if (!element) {
    return;
  }
  CPS.Effects.unSetMouseOver(elementId);
  Event.stopObserving(element, "click", callable);
}

/* cookies */
CPS.Cookies = {};

CPS.Cookies.set = function(name, value) {

  var argv = this.set.arguments;
  var argc = this.set.arguments.length;
  var expires = (argc > 2) ? argv[2] : null;
  var path = (argc > 3) ? argv[3] : null;
  var domain = (argc > 4) ? argv[4] : null;
  var secure = (argc > 5) ? argv[5] : false;
  document.cookie = name + "=" + escape(value) +
    ((expires==null) ? "" : ("; expires="+expires.toGMTString())) +
    ((path==null) ? "" : ("; path=" + path)) +
    ((domain==null) ? "" : ("; domain=" + domain)) +
    ((secure==true) ? "; secure" : "");
}

CPS.Cookies._get = function(offset)
{
  var endstr = document.cookie.indexOf (";", offset);
  if (endstr==-1) {
    endstr = document.cookie.length;
  }
  return unescape(document.cookie.substring(offset, endstr));
}

CPS.Cookies.get = function(name) {
  var arg = name + "=";
  var alen = arg.length;
  var clen = document.cookie.length;
  var i = 0;

  while (i<clen) {
    var j = i + alen;
    if (document.cookie.substring(i, j) == arg) {
      return this._get(j);
    }
    i = document.cookie.indexOf(" ", i) + 1;
    if (i==0) break;
  }
  return null;
}

CPS.Cookies.del = function(name) {
  date = new Date;
  date.setFullYear(date.getFullYear()-1);
  this.set(name, null, date);
}
