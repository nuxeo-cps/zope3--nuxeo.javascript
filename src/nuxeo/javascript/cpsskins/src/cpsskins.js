/*

 Copyright (c) 2005 Nuxeo and Contributors.
 All Rights Reserved.

 This software is subject to the provisions of the Zope Public License,
 Version 2.1 (ZPL).  A copy of the ZPL should accompany this distribution.
 THIS SOFTWARE IS PROVIDED "AS IS" AND ANY AND ALL EXPRESS OR IMPLIED
 WARRANTIES ARE DISCLAIMED, INCLUDING, BUT NOT LIMITED TO, THE IMPLIED
 WARRANTIES OF TITLE, MERCHANTABILITY, AGAINST INFRINGEMENT, AND FITNESS
 FOR A PARTICULAR PURPOSE.

 CPSSkins AJAX library

 Author: Jean-Marc Orliaguet <jmo@chalmers.se>

*/

// For debugging - to remove later.
function debug(obj) {
  var msg, debugbox;
  debugbox = $("message");
  if (!debugbox) {
    var div = document.createElement("DIV");
    div.setAttribute("id", "message");
    document.getElementsByTagName("body").item(0).appendChild(div);
  }
  try {
     msg = obj.inspect().escapeHTML();
  } catch(e) {
     msg = e;
  }
  $("message").innerHTML += msg + '</br>';
}

var CPSSkins = {
  Version: "0.8",

  Controllers: $H({}),
  Effects: $H({}),
  Storages: $H({}),
  Widgets: $H({}),

  _subscribers: $H({}),
  _models: $H({}),
  _views: $H({}),
  _controllers: $H({}),
  _action_handlers: $H({}),

  _initialized: $H({}),
  _defs: $H({}),

  init: function() {
    CPSSkins._setup();
    CPSSkins._parse(document);
  },

  getModelById: function(id) {
    return this._models[id];
  },

  getControllerById: function(id) {
    return this._controllers[id];
  },

  getViewById: function(id) {
    return this._views[id];
  },

  getViews: function() {
    return this._views.pluck('value');
  },

  registerControllers: function(controllers) {
    Object.extend(this.Controllers, controllers)
  },

  registerEffects: function(effects) {
    Object.extend(this.Effects, effects)
  },

  registerStorages: function(storages) {
    Object.extend(this.Storages, storages)
  },

  registerWidgets: function(widgets) {
    Object.extend(this.Widgets, widgets)
  },

  /* Error handling */
  warn: function(msg, context) {
    var div = document.createElement("div");
    $(div).addClassName("warningMessage");
    div.innerHTML = msg;
    context.parentNode.replaceChild(div, context);
  },

  /* Comparison */

  compare: function(a, b) {
    if (a == undefined || b == undefined) {
      return true;
    }
    if (typeof a == 'object' && typeof b == 'object') {
      if (a.hash != undefined && b.hash != undefined) {
        return a.hash() == b.hash();
      }
    }
    return (a == b);
  },

  /* Action handlers */
  addActions: function(actions) {
    Object.extend(this._action_handlers, actions);
  },

  getAction: function(action_id) {
    return this._action_handlers[action_id];
  },

  /* Event system */
  subscribe: function(eventid, event) {
    if (!(eventid in this._subscribers)) {
      this._subscribers[eventid] = [];
    }
    if (this._subscribers[eventid].findAll(function(e) {
      if (event == undefined) return true;
      if (event.scope != undefined) {
        if (event.scope != e.scope) return false;
      }
      return (CPSSkins.compare(event.subscriber, e.subscriber) &&
              CPSSkins.compare(event.publisher, e.publisher))
    }).length == 0) {
      this._subscribers[eventid].push(event);
    }
  },

  unsubscribe: function(eventid, event) {
    var subscribers = this._subscribers;
    if (!(eventid in subscribers)) { return; }
    subscribers[eventid] = subscribers[eventid].reject(function(e) {
      if (event == undefined) return true;
      if (event.scope != undefined) {
        if (event.scope != e.scope) return false;
      }
      return (CPSSkins.compare(event.subscriber, e.subscriber) &&
              CPSSkins.compare(event.publisher, e.publisher))
      });
    if (subscribers[eventid].length == 0) {delete subscribers[eventid]}
  },

  notify: function(eventid, event) {
    var subscribers = this._subscribers;
    var publisher = event.publisher;
    (subscribers[eventid] || []).findAll(function(e) {
      if (event == undefined) return true;
      if (event.scope != undefined) {
        if (event.scope != e.scope) return false;
      }
      return (CPSSkins.compare(event.subscriber, e.subscriber) &&
              CPSSkins.compare(event.publisher, e.publisher))
    }).each(function(e) {
      var handler = CPSSkins.getEventHandler(eventid, e.subscriber);
      if (handler) {
        // set the publisher in case no publisher is specified.
        event.subscriber = e.subscriber;
        event.publisher = publisher;
        handler(event);
      }
    });
  },

  registerEventHandler: function(eventid, subscriber, handler) {
    var handlers = subscriber._handlers;
    if (!handlers) {
      subscriber._handlers = new Object();
    }
    subscriber._handlers[eventid] = handler;
  },

  getEventHandler: function(eventid, subscriber) {
    return (subscriber._handlers || {})[eventid];
  },

  /* Document parsing */

  _setup: function() {
  },

  _jsonParse: function(el, text) {
    var res = {};
    try {
      res = JSON.parse(text.unescapeHTML());
    } catch(e) {
      var msg = e.id + ": " + e.message + "<pre>" + e.text + "</pre>";
      CPSSkins.warn(msg, el);
    }
    return res;
  },

  // first stage
  _parse: function(node) {
    var elements = $A(node.getElementsByTagName("ins")).select(function(e) {
      return (e.className.match(new RegExp("model|view|controller")));
    });
    var length = elements.length;
    if (!length) {
      return;
    }
    var progress = {'initialized': 0};

    this.registerEventHandler("initialized", progress, function(event) {
      var progress = event.scope;
      progress.initialized += 1;
      if (progress.initialized >= length) {
        CPSSkins._load(node);
        CPSSkins.unsubscribe("initialized", {'scope': progress});
        CPSSkins.notify("parsed", {'publisher': node});
        CPSSkins.getViews().invoke('attachControllers');
      }
    });
    CPSSkins.subscribe("initialized",
      {'subscriber': progress, 'scope': progress}
    );

    elements.each(function(el) {
      var url = el.getAttribute("cite");
      if (url) {
        var options = {
          onComplete: function(req) {
            CPSSkins._eval(el, req.responseText);
            CPSSkins.notify('initialized', {'publisher': el, 'scope': progress});
          }
        };
        var parts = url.split('?');
        if (parts.length == 2) {
          url = parts[0];
          options.parameters = parts[1];
        }
        new Ajax.Request(url, options);
      } else {
        /* the definition is written inline */
        CPSSkins._eval(el, el.innerHTML);
        el.innerHTML = '';
        CPSSkins.notify('initialized', {'publisher': el, 'scope': progress});
      }
    });
  },

  _eval: function(el, text) {
    var def = this._jsonParse(el, text);
    var id = def.id;
    if (!id) {
      CPSSkins.warn("Component has no id: <pre>" + text + "</pre>", el);
    }
    el.componentid = id;
    this._defs[[el.className, id]] = def;
  },

  // second stage
  _load: function(node) {
    var elements = $A(node.getElementsByTagName("ins"));
    ["view", "controller", "model"].each(function(type) {
      elements.each(function(el) {
        if ($(el).hasClassName(type)) {
          CPSSkins._register(node, el, type);
        }
      });
    });
  },

  _register: function(node, el, classid) {
      var def = this._defs[[classid,el.componentid]];
      var id = def.id;

      switch(classid) {

        case "controller": {
          var controller = this.getControllerById(id);
          if (!controller) {
            var controller_type = def.type || "command";
            var factory = this.Controllers[controller_type];
            if (factory) {
              controller = factory(node, def);
              this._controllers[id] = controller;
            }
            CPSSkins.notify("registered controller",
              {'publisher': controller, 'scope': id}
            );
          }
          break;
        }

        case "model": {
          var model = this.getModelById(id);
          if (!model) {
            model = new CPSSkins.Model(node, def);
            this._models[id] = model;
            CPSSkins.notify("registered model",
              {'publisher': model, 'scope': id}
            );
          }
          break;
        }

        case "view": {
          var widget_type;

          var template = def.widget.template;
          var area = def.widget.area;

          if (area && template) {
            CPSSkins.warn("Cannot specify both a widget area and a template.",
                          el);
          }

          if (area) {
            widget_type = 'area';
          }

          if (template) {
            widget_type = 'custom';
          } else {
            /* generic widget type */
            widget_type = widget_type || def.widget.type;
            if (!widget_type) {
              CPSSkins.warn("Must specify a widget type or a template", el);
            } else if (!(widget_type in this.Widgets)) {
              CPSSkins.warn("Unknown widget type: " + widget_type, el);
            }
          }

          var view = this.getViewById(id);
          if (!view) {
            factory = this.Widgets[widget_type];
            view = factory(def);
            this._views[id] = view;
          }

          /* create the view */
          if (view) {

            /* register the observed model */
            var model_id = def.model;
            if (model_id) {
              CPSSkins.registerEventHandler("registered model", view,
              function(event) {
                var model = event.publisher;
                var view = event.subscriber;
                view.observe(model);
                CPSSkins.unsubscribe("registered model",
                  {'scope': model.hash()}
                );
              });
              CPSSkins.subscribe("registered model",
                {'subscriber': view, 'scope': model_id}
              );
            }

            /* insert the widget into the DOM */
            var replace = def.widget.replace;
            if (replace) {
              var replaced = $(replace);
              if (replaced) {
                replaced.parentNode.replaceChild(view.widget, replaced);
              } else {
                CPSSkins.warn("Unknown node id: " + replace, el);
              }
            } else if (!area) {
              el.parentNode.insertBefore(view.widget, el);
            }

            CPSSkins.notify("registered view",
              {'publisher': view, 'scope': id}
            );
          }
          break;
        }

      }
  }

}

Event.observe(window, "load", CPSSkins.init);

CPSSkins.Set = Class.create();
CPSSkins.Set.prototype = {

  initialize: function(x) {
    this._elements = $H({});
    if (typeof x == 'string') { x = [x] };
    $A(x).each(function(e) {
      this.add(e);
    }.bind(this));
  },

  add: function(x) {
    if (typeof x == 'string') { x = [x] };
    $A(x).each(function(e) {
      this._elements[e] = true;
    }.bind(this));
  },

  remove: function(x) {
    if (typeof x == 'string') { x = [x] };
    $A(x).each(function(e) {
      delete this._elements[e];
    }.bind(this));
  },

  contains: function(x) {
    return x in this._elements;
  },

  entries: function() {
    return this._elements.keys();
  },

  _each: function(iterator) {
    this.entries()._each(iterator);
  },

  each: Enumerable.each

}


// Controller

CPSSkins.Controller = Class.create();
CPSSkins.Controller.prototype = {

  initialize: function(node, def) {
    this.node = node;
    this.def = def;
    this.views = new CPSSkins.Set();
    this.setup();
  },

  hash: function() {
    return this.def.id;
  },

  refreshViews: function() {
    this.views.entries().each(function(v) {
      CPSSkins.getViewById(v).refresh();
    });
  },

  setup: function() {
    /* to override */
  },

  register: function(view) {
    /* to override */
  },

  unregister: function(view) {
    /* to override */
  },

  update: function(view) {
    /* to override */
  }
}

CPSSkins.registerControllers({

  'command': function(node, def) {
    return new CPSSkins.CommandController(node, def);
  },

  'behaviour': function(node, def) {
    return new CPSSkins.BehaviourController(node, def);
  },

  'form': function(node, def) {
    return new CPSSkins.FormController(node, def);
  },

  'remote scripting': function(node, def) {
    return new CPSSkins.RemoteScriptingController(node, def);
  },

  'focus observer': function(node, def) {
    return new CPSSkins.FocusObserver(node, def);
  },

  'drag-and-drop': function(node, def) {
    return new CPSSkins.DragAndDropController(node, def);
  },

  'perspective selector': function(node, def) {
    return new CPSSkins.PerspectiveSelector(node, def);
  }

});

CPSSkins.CommandController = Class.create();
CPSSkins.CommandController.prototype = Object.extend(new CPSSkins.Controller(), {

  register: function(view) {

    var controller = this;

    CPSSkins.registerEventHandler("command", controller, function(event) {
      var view = event.publisher;
      var controller = event.subscriber;

      // add some contextual info
      event.view = view;
      event.model = view.model;

      var action = event.options.action;
      /* the event handler calls the controller's registered handler */
      if (action) {
        var action_handler = CPSSkins.getAction(action);
        if (action_handler) action_handler(event);
      }
    });

    CPSSkins.subscribe("command", {'subscriber': controller, 'publisher': view});
  },

  unregister: function(view) {
    CPSSkins.unsubscribe("command", {'subscriber': this, 'publisher': view});
  }

});

CPSSkins.BehaviourController = Class.create();
CPSSkins.BehaviourController.prototype = Object.extend(new CPSSkins.Controller(), {

  register: function(view) {
    var controller = this;
    var rules = this.def.rules;
    var model = view.model;
    var controller = this;
    var info = {'model': model, 'view': view, 'controller': controller};

    $H(rules).each(function(r) {
      var selector = $$(r.key);
      if (selector) {
        $H(r.value).each(function(s) {
          var event_name = s.key;
          var action_id = s.value;
          var handler = CPSSkins.getAction(action_id);
          selector.each(function(el) {
            Event.observe(el, event_name, handler.bindAsEventListener(info));
          });
        })
      }
    })
  },

  unregister: function(view) {
  }

});

CPSSkins.FormController = Class.create();
CPSSkins.FormController.prototype = Object.extend(new CPSSkins.Controller(), {

  setup: function() {
    this.submitEvent = this.submitEvent.bindAsEventListener(this);
  },

  register: function(view) {
    Event.observe(view.widget, "submit", this.submitEvent);
  },

  unregister: function(view) {
    Event.stopObserving(view.widget, "submit", this.submitEvent);
  },

  submitEvent: function(e) {
    this.views.each(function(v) {
      var view = CPSSkins.getViewById(v);
      var model = view.model;
      var widget = view.widget;

      var form_data = {};
      $A(Form.getInputs(widget)).each(function(i) {
        form_data[i.name] = Form.Element.getValue(i);
      });

      model.setData(form_data);
    });
    return false;
  }

});

CPSSkins.RemoteScriptingController = Class.create();
CPSSkins.RemoteScriptingController.prototype = Object.extend(
  new CPSSkins.Controller(), {

  setup: function() {
    this.clickEvent = this.clickEvent.bindAsEventListener(this);
    this.submitEvent = this.submitEvent.bindAsEventListener(this);
  },

  register: function(view) {
    Event.observe(view.widget, "click", this.clickEvent);
    Event.observe(view.widget, "submit", this.submitEvent);
  },

  unregister: function(view) {
    Event.stopObserving(view.widget, "click", this.clickEvent);
    Event.stopObserving(view.widget, "submit", this.submitEvent);
  },

  submitEvent: function(e) {
    var target = Event.findElement(e, 'form');
    if (target && target != document) {
      var method = target.getAttribute('action');
      var params = Form.serialize(target);
      if (!method) return;
      var _request = this._request;
      var views = this.views;
      views.entries().each(function(v) {
        var view = CPSSkins.getViewById(v);
        if (target.childOf(view.widget)) {
          _request(views, view, method, params);
        }
      });
      Event.stop(e);
    }
  },

  clickEvent: function(e) {
    var target = $(Event.element(e));
    if (target.tagName.toLowerCase() != 'a') {
      target = Event.findElement(e, 'a');
    }
    if (target && target != document) {

      var href = target.href;
      var method = href;
      var params = {};

      if (href.match(/^javascript:/)) {
        eval(href);
      } else {
        var parts = href.split('?');

        if (parts.length == 2) {
          method = parts[0];
          params = parts[1];
        }
      }

      var _request = this._request;
      var views = this.views;
      views.entries().each(function(v) {
        var view = CPSSkins.getViewById(v);
        if (target.childOf(view.widget)) {
          _request(views, view, method, params);
        }
      });
      Event.stop(e);
    }
  },

  _request: function(views, view, url, params) {
    var options = {
      onComplete: function(req) {
        var disp = req.getResponseHeader('content-disposition');
        if (disp && disp.match(/^attachment/)) {
          window.location = url;
        }
        var content_type = req.getResponseHeader('content-type');
        if (content_type.match(/^text\/x-json/)) {
          var data = JSON.parse(req.responseText);
          view.model.updateData(data);
        }
        views.entries().each(function(v) {
          CPSSkins.getViewById(v).refresh();
        });
      }
    };
    options.parameters = params;
    new Ajax.Request(url, options);
  }

});

CPSSkins.FocusObserver = Class.create();
CPSSkins.FocusObserver.prototype = Object.extend(new CPSSkins.Controller(), {

  setup: function() {

    var controller = this;

    CPSSkins.registerEventHandler("gained focus", controller, function(event) {
      var view = event.publisher;
      var selected = event.context;
      if (!view.def.model) {
        var model = CPSSkins.Canvas.getModel(selected);
        if (model) {
          view.observe(model);
        }
      }
    });

    CPSSkins.registerEventHandler("lost focus", controller, function(event) {
      var view = event.publisher;
      view.stopObserving();
    });

    CPSSkins.subscribe("gained focus", {'subscriber': controller});
    CPSSkins.subscribe("lost focus", {'subscriber': controller});
  }

});

CPSSkins.DragAndDropController = Class.create();
CPSSkins.DragAndDropController.prototype = Object.extend(
  new CPSSkins.Controller(), {

  setup: function() {
    this.moveEvent = this.moveEvent.bindAsEventListener(this);
    this.dropEvent = this.dropEvent.bindAsEventListener(this);
    this.cancelEvent = new Function("return false");

    // cancel text selection
    document.onselectstart = this.cancelEvent;

    this._last_updated = 0;
  },

  register: function(view) {
    var dragging = this.def.dragging;
    if (!dragging) {
      return;
    }
    var widget = view.widget;

    var shifting = this.def.shifting;
    if (shifting) {
      if (shifting.element) {
        this._shiftablezones = document.getElementsByClassName(
                               shifting.element)
      }
      if (shifting.container) {
        this._containerzones = document.getElementsByClassName(
                               shifting.container)
      }
    }
    if (this.def.dropping) {
      if (this.def.dropping.target) {
        this._dropzones = document.getElementsByClassName(
                          this.def.dropping.target)
      }
    }

    var dragEvent = this.dragEvent.bindAsEventListener(
                      Object.extend(this, {'widget': widget}));
    Event.observe(widget, "mousedown", dragEvent);

  },

  unregister: function(view) {
    var widget = view.widget;
    var dragEvent = this.dragEvent.bindAsEventListener(
                      Object.extend(this, {'widget': widget}));
    Event.stopObserving(widget, "mousedown", dragEvent);
  },

  _findDraggable: function(e) {
    var element = $(Event.element(e));
    var source = this.def.dragging.source || '';
    var handle = this.def.dragging.handle || '';
    var widget = this.widget;
    if (handle && !element.hasClassName(handle)) {
      return null;
    }
    while($(element).parentNode) {
      if (element.hasClassName(source)) {
        return element;
      }
      element = element.parentNode;
    }
    return null;
  },

  _getVerticalSpeed: function(y) {
    if (!this._previousY) this._previousY = y;
    var speed = y - this._previousY;
    this._previousY = y;
    return speed;
  },

  _findNext: function(el) {
    var shiftablezones = this._shiftablezones;
    while (el) {
      el = el.nextSibling;
      if (!el) return null;
      if (el.nodeType == 1) {
        if (shiftablezones.indexOf(el) >= 0) {
          return el;
        }
      }
    }
    return null;
  },

  dragEvent: function(e) {
    if (!Event.isLeftClick(e)) return false;
    var draggable = this._findDraggable(e);
    if (!draggable) {
      return false;
    }
    Event.stop(e);

    this.target = $(draggable);
    var pos = Position.cumulativeOffset(draggable);

    var x = Event.pointerX(e);
    var y = Event.pointerY(e);
    this.x0 = pos[0];
    this.y0 = pos[1];

    var dragging = this.def.dragging;
    var shifting = this.def.shifting;

    if (dragging.offset_x || dragging.offset_y ) {
      this.x1 = dragging.offset_x || -5;
      this.y1 = dragging.offset_y || -5;
    } else {
      this.x1 = x - this.x0;
      this.y1 = y - this.y0;
    }

    if (this.def.dragging.feedback) {
      var dim = draggable.getDimensions();
      var feedback = CPSSkins.Canvas.createNode({"tag": "div"});
      feedback.setStyle({
        'z-index': parseInt(draggable.getStyle('z-index') || 0) +1,
        'width': dim.width + 'px',
        'height': dim.height + 'px'
      });
      if (this.def.dragging.feedback.clone) {
        var clone = $(draggable.cloneNode(true));
        clone.setStyle({'margin': '0'});
        feedback.appendChild(clone);
      } else {
        feedback.setStyle({
          'border-color': this.def.dragging.feedback.border || '#000',
          'background-color': this.def.dragging.feedback.background || '#fc3',
          'border-style': 'solid',
          'border-width': '1px'
        })
      }
      feedback.setOpacity(this.def.dragging.feedback.opacity);
      document.getElementsByTagName('body')[0].appendChild(feedback);
      this.moved = feedback;
    } else {
      if (!this.def.shifting) {
        this.moved = draggable;
      }
    }
    this.dragged = draggable;
    this.dragged.setOpacity(this.def.dragging.opacity || 0.8);

    this.moved.setStyle({'position': 'absolute'});
    this.moved.moveTo({'x': x-this.x1, 'y': y-this.y1});

    Event.observe(document, "mousemove", this.moveEvent);
    Event.observe(document, "mouseup", this.dropEvent);

    if (this.def.dropping) {
      var highlight = this.def.dropping.highlight;
      if (highlight && this._dropzones) {
        this._dropzones.each(function(el) {
          CPSSkins.Effects.activate(el,
            {'duration': highlight.duration || 1000}
          );
        });
      }
    }
  },

  moveEvent: function(e) {
    var x = Event.pointerX(e);
    var y = Event.pointerY(e);
    this.moved.moveTo({'x': x-this.x1, 'y': y-this.y1});
    Event.stop(e);

    var now = new Date().getTime();
    if (now < this._last_updated + 100) return;
    this._last_updated = now;

    var shifting = this.def.shifting;
    if (shifting) {
      var shifted = false;
      var speed = this._getVerticalSpeed(y);
      this._shiftablezones.each(function(s) {
        if (Position.within(s, x, y)) {
          if (speed > 0) {
            var target = this._findNext(s);
          } else {
            var target = s;
          }
          s.parentNode.insertBefore(this.dragged, target);
          shifted = true;
          this.droptarget = target;
          return;
        };
      }.bind(this));

      if (!shifted && this._containerzones) {
        this._containerzones.each(function(s) {
          if (Position.within(s, x, y)) {
            s.appendChild(this.dragged);
            return;
          };
        }.bind(this));
      }
    }

    if (this.def.dragging.feedback) {
      if (this.target)
        var dim = this.target.getDimensions();
        this.moved.setStyle({
          'width': dim.width + 'px', 'height': dim.height + 'px'
        });
    }
  },

  dropEvent: function(e) {
    Event.stopObserving(document, "mousemove", this.moveEvent);
    Event.stopObserving(document, "mouseup", this.dropEvent);

    var x = Event.pointerX(e);
    var y = Event.pointerY(e);

    var inTarget = false;
    var dropzones = this._dropzones || [];
    if (this.def.dropping) {
      dropzones.each(function(d) {
        if (Position.within(d, x, y)) {
          inTarget = true;
          this.target = d;
        };
      }.bind(this));
    }

    var zoomback = this.def.dragging.zoomback;
    if (inTarget) {
      zoomback = false;
    }

    var dropping = this.def.dropping;
    if (dropping) {
      var action_id = dropping.action;
      if (action_id) {
        var action_handler = CPSSkins.getAction(action_id);
        if (action_handler) action_handler({
          'source': this.dragged,
          'target': this.droptarget || this.target,
          'context': this
        });
      }
    }

    if (this.def.dragging.feedback) {
      if (zoomback) {
        this.moved.moveTo({
          'x': this.x0,
          'y': this.y0,
          'duration': zoomback.duration || 400,
          'onComplete': function() { this.parentNode.removeChild(this); }
        });
      }
    }

    if (this.def.dropping) {
      var highlight = this.def.dropping.highlight;
      if (highlight && this._dropzones) {
        this._dropzones.each(function(el) {
          CPSSkins.Effects.deactivate(el,
            {'duration': highlight.duration || 1000}
          );
        });
      }
      var zoomto = this.def.dropping.zoomto;
      if (zoomto) {
        var pos = Position.cumulativeOffset(this.target);
        this.moved.moveTo({
          'x': pos[0],
          'y': pos[1],
          'duration': zoomto.duration || 400,
          'onComplete': function() { this.parentNode.removeChild(this); }
        });
      }
    }

    if (this.def.dragging.feedback && !zoomback && !zoomto) {
      this.moved.parentNode.removeChild(this.moved);
    }

    this.dragged.setOpacity(1);
    Event.stop(e);
  }

});

CPSSkins.PerspectiveSelector = Class.create();
CPSSkins.PerspectiveSelector.prototype = Object.extend(
  new CPSSkins.Controller(), {

  setup: function() {
    this._visible_views = {};
    this._current = null;
    CPSSkins.registerEventHandler("parsed", this, function(event) {
      var perspective = this._current || this.def.initial;
      if (perspective) {
        this.switchTo(perspective);
      }
    }.bind(this));
    CPSSkins.subscribe("parsed", {"subscriber": this, "publisher": this.node});
  },

  register: function(view) {
    var visible = this._visible_views;
    var view_id = view.hash();
    var current_perspective = this._current;
    $A(view.def.perspectives).each(function(p) {
      if (!(p in visible)) {
        visible[p] = [];
      }
      if (visible[p].indexOf(view_id) < 0) {
        visible[p].push(view_id);
      }
    });
  },

  update: function(view) {
    var current_perspective = this._current;
    if ($A(view.def.perspectives).indexOf(current_perspective) >= 0) {
      view.show();
    }
  },

  switchTo: function(perspective) {
    this._previous = this._current;
    this._current = perspective;
    var to_show = this._visible_views[perspective] || [];
    var to_hide = this.views.entries().select(function(v) {
      return to_show.indexOf(v) < 0;
    });
    to_hide.each(function(v) { CPSSkins.getViewById(v).hide(); });
    to_show.each(function(v) { CPSSkins.getViewById(v).show(); });
  },

  goBack: function() {
    this.switchTo(this._previous);
  }

});

// Identifiable DOM elements.
if (!CPSSkins.Identifiable) { CPSSkins.Identifiable = new Object() }
Object.extend(CPSSkins.Identifiable, {

  isIdentifiable: function(node) {
    node = $(node);

    if (node.nodeType != 1) {
      return false;
    }

    if (node.tagName.toLowerCase() == "ins") {
      return false;
    }

    if (node.getAttribute("id")) {
      return true;
    }

    return false;
  },

  getIdentifiable: function(node) {
    node = $(node);
    if (this.isIdentifiable(node)) { return node; }
    return this.getParent(node);
  },

  getParent: function(node) {
    while (node) {
      node = node.parentNode;
      if (!node) return null;
      if (this.isIdentifiable(node)) { return node; }
    }
    return null;
  }

});



if (!CPSSkins.Canvas) {
  CPSSkins.Canvas = {
    _styles: {},
    _scripts: {}
  }
}

Object.extend(CPSSkins.Canvas, {

  getModel: function(node) {
    if (!node) return null;
    var model_node = this._getModelNode(node);
    if (model_node) {
      var id = model_node.componentid;
      if (id) {
        return CPSSkins.getModelById(id);
      }
    }
    return null;
  },

  _getModelNode: function(node) {
    while(node = node.previousSibling) {
      if (node.nodeType == 1) {
        if (node && node.tagName.toLowerCase() == "ins"
                 && $(node).hasClassName("model")) {
          return node;
        } else {
          return null;
        }
      }
    }
    return null;
  },

  createNode: function(options) {
    var node = $(document.createElement(options.tag));
    node.addClassName(options.classes);
    node.setStyle(options.style);
    $H(options.attributes).each(function(attr) {
      node.setAttribute(attr.key, attr.value)
    });
    if (options.text) {
      node.appendChild(document.createTextNode(options.text));
    }
    return node;
  },

  addStyleSheet: function(id, src) {
    if (id in this._styles) {
      return;
    }
    var head = document.getElementsByTagName("head")[0];
    var link = document.createElement("link");
    link.id = "cpsskins-style-" + id;
    link.rel = "stylesheet";
    link.href = src;
    link.type = "text/css";
    head.appendChild(link);
    this._styles[id] = src;
  },

  removeStyleSheet: function(id) {
    if (id in this._styles) {
      delete this._styles[id];
    }
    var style = document.getElementById("cpsskins-style-" + id);
    if (style) {
      style.parentNode.removeChild(style);
    }
  },

  addScript: function(id, src) {
    if (id in this._scripts) {
      return;
    }
    var head = document.getElementsByTagName("head")[0];
    var script = document.createElement("script");
    script.id = "cpsskins-script-" + id;
    script.src = src;
    script.type = "text/javascript";
    head.appendChild(script);
    this._scripts[id] = src;
  },

  removeScript: function(id) {
    if (id in this._scripts) {
      delete this._scripts[src];
    }
    var script = document.getElementById("cpsskins-script-" + id);
    if (script) {
      script.parentNode.removeChild(script);
    }
  }

});

if (!window.Element)
  var Element = new Object();

if (!Element.Methods)
  Element.Methods = new Object();

Element.addMethods({

  setOpacity: function(element, opacity) {
    if (window.ActiveXObject) {
      element.style.filter = "alpha(opacity=" + opacity*100 + ")";
    } else {
      element.style.opacity = opacity;
    }
  },

  setBackgroundColor: function(element, options) {
    var r = parseInt(options.r * 255);
    var g = parseInt(options.g * 255);
    var b = parseInt(options.b * 255);
    element.style.backgroundColor = 'rgb(' + r + ',' + g + ',' + b + ')';
  },

  getBackgroundColor: function(element) {
    var regExp = new RegExp("^rgb\\((\\d+),(\\d+),(\\d+)\\)$");
    var bgColor = element.getStyle('background-color') || 'rgb(255,255,255)';
    var match = regExp.exec(bgColor.replace(/\s+/g,''));
    if (!match) return {'r': 1, 'g': 1, 'b': 1};
    return {'r': match[1]/255, 'g': match[2]/255, 'b': match[3]/255}
  },

  moveTo: function(element, options) {
    var x = options.x;
    var y = options.y;
    if (options.duration) {
      var pos = Position.cumulativeOffset(element);
      var x0 = pos[0];
      var y0 = pos[1];
      new CPSSkins.Scheduler(Object.extend(options, {
        action: function(value) {
          element.setStyle({
            'left': x0 + (x - x0) * value + 'px',
            'top': y0 + (y - y0) * value + 'px'
          });
        },
        onComplete: (options.onComplete || function() {}).bind(element)
      }));
    }
    element.setStyle({'left': x + 'px', 'top': y + 'px' });
  },

  fitInsideScreen: function(element) {
    var dimensions = element.getDimensions();
    var width = dimensions.width;
    var height = dimensions.height;
    var page_w = window.innerWidth || document.body.clientWidth;
    var page_h = window.innerHeight || document.body.clientHeight;
    var top = element.style.top;
    var left = element.style.left;
    if (top) {
      top = parseInt(top);
      if (top + height > page_h) { element.style.top = top - height + "px"};
    }
    if (left) {
      left = parseInt(left);
      if (left + width > page_w) { element.style.left = left - width + "px"};
    }
  }

});


CPSSkins.Scheduler = Class.create();
CPSSkins.Scheduler.prototype = {

  initialize: function(options) {
    this.delay = options.delay || 0;
    this.duration = options.duration || 300;
    this.action = options.action || function(value) {};
    this.onComplete = options.onComplete || function() {};

    this.started = false;
    this.start();
  },

  start: function() {
    this.startTime = (new Date).getTime();
    this.timer = setInterval(this.step.bind(this), 20);
   },

  step: function() {
    var pos = ((new Date).getTime() - this.startTime - this.delay)
              / this.duration;
    if (pos < 0) return;
    if (pos > 1) {
      this.stop();
    } else {
      this.action((1-Math.cos(pos*Math.PI))/2);
      this.started = true;
    }
  },

  stop: function() {
    clearInterval(this.timer);
    this.onComplete();
  }

}


// Effects

CPSSkins.registerEffects({

  show: function(node, options) {
    var delay = options.delay;
    if (delay) {
      return new CPSSkins.Scheduler({
        delay: delay,
        onComplete: function() { node.show(); }
      });
    } else {
      node.show();
    }
  },

  hide: function(node, options) {
    var delay = options.delay;
    if (delay) {
      return new CPSSkins.Scheduler({
        delay: delay,
        onComplete: function() { node.hide(); }
      });
    } else {
      node.hide();
    }
  },

  fadein: function(node, options) {
    var opacity = node.style.opacity;
    if (!opacity) node.setOpacity(0);
    Object.extend(options, {
      action: function(value) { if (value > opacity) node.setOpacity(value) },
      onComplete: function() { node.show() }
    });
    return new CPSSkins.Scheduler(options);
  },

  fadeout: function(node, options) {
    var opacity = node.style.opacity;
    Object.extend(options, {
      action: function(value) { if (value < opacity) node.setOpacity(1-value) },
      onComplete: function() { node.hide(); node.style.opacity = '' }
    });
    return new CPSSkins.Scheduler(options);
  },

  blinddown: function(node, options) {
    var height = node.getHeight();
    node.makeClipping();
    Object.extend(options, {
      action: function(value) {
        node.setStyle({height: height*value + 'px'});
      },
      onComplete: function() {
        node.setStyle({height: height + 'px'});
        node.undoClipping();
      }
    });
    return new CPSSkins.Scheduler(options);
  },

  blindup: function(node, options) {
    var height = node.getHeight();
    node.makeClipping();
    Object.extend(options, {
      action: function(value) {
        node.setStyle({height: height*(1-value) + 'px'});
      },
      onComplete: function() { node.setStyle({height: '0px'}); }
    });
    return new CPSSkins.Scheduler(options);
  },

  activate: function(node, options) {
    var bg = node.getBackgroundColor();
    if (!node._saved_bg_color) {
      node._saved_bg_color = bg;
    }
    Object.extend(options, {
      action: function(value) {
        node.setBackgroundColor({'r': bg.r, 'g': bg.g, 'b': bg.b-value});
      }
    });
    return new CPSSkins.Scheduler(options);
  },

  deactivate: function(node, options) {
    var bg = node._saved_bg_color;
    Object.extend(options, {
      action: function(value) {
        node.setBackgroundColor({'r': bg.r, 'g': bg.g, 'b': bg.b-(1-value)});
      },
      onComplete: function() { node.setBackgroundColor(bg) }
    });
    return new CPSSkins.Scheduler(options);
  }

});

// Model

CPSSkins.Model = Class.create();
CPSSkins.Model.prototype = {

  initialize: function(node, def) {
    this.node = this.node;
    this.def = def;
    // set the schema
    this.schema = this._setSchema();
    // set the storage adapter
    this.storage = this._setStorageAdapter();
  },

  hash: function() {
    return this.def.id;
  },

  // low-level I/O
  readData: function() {
    return this._data || this.def.data;
  },

  writeData: function(data) {
    this._data = data;
  },

  // high-level I/O
  getData: function() {
    this.storage.readTransaction(); /* asynchronous call */
    return this.readData();
  },

  setData: function(data) {
    this.storage.writeTransaction(data);
  },

  updateData: function(data) {
    var current_data = this.storage.read() || new Object();
    new_data = $H(current_data).merge(data);
    this.setData(new_data);
  },

  addObserver: function(view) {
    var model = this;
    // observers subscribes to events on the model
    CPSSkins.registerEventHandler('changed', view, function(event) {
      var view = event.subscriber;
      view.refresh();
    });
    CPSSkins.subscribe('changed', {'subscriber': view, 'publisher': model});
  },

  removeObserver: function(view) {
    var model = this;
    CPSSkins.unsubscribe('changed', {'subscriber': view, 'publisher': model});
  },

  /* Private API */
  _setSchema: function() {
    var initial_data = this.def.data;
    var schema = $H({});
    $H(initial_data).each(function(f) {
      var field = f.key;
      var value = f.value;
      schema[field] = typeof value;
    });
    return schema;
  },

  _setStorageAdapter: function() {
    var storage_def = this.def.storage;
    if (!storage_def) {
      storage_def = {"type": "ram"};
      this.def.storage = storage_def;
    }
    var model = this;
    var storage = CPSSkins.Storages[storage_def.type](this);

    // the model reacts to events on the storage and notifies observers
    CPSSkins.registerEventHandler('stored', model, function(event) {
      var model = event.subscriber;
      CPSSkins.notify('changed', {'publisher': model});
    });

    CPSSkins.subscribe('stored', {'subscriber': model, 'publisher': storage});

    var refresh = storage_def.refresh;
    if (refresh && refresh > 0) {
      new PeriodicalExecuter(function() {storage.requestData()}, refresh);
    }

    return storage;
  }

}

// Storage adapter base class
CPSSkins.StorageAdapter = Class.create();
CPSSkins.StorageAdapter.prototype = {

  initialize: function(model) {
    this.model = model;
    this.setup();
    this._queue = [];
    this._queued_data = {};
  },

  readTransaction: function(data) {
    // TODO: implement read access sequences
    this.requestData();
  },

  writeTransaction: function(data) {
    var access = this.model.def.storage.access;
    if (access) {
      var size = access.size;
      switch (access.type) {
        case 'queue': {
          if (this._queue.length < size || size == null) {
            this._queue.push(data[access.signature]);
          }
          break;
        }
        case 'stack': {
          this._queue.unshift(data[access.signature]);
          if (size && size > 0) {
            this._queue = this._queue.slice(0, size);
          }
          break;
        }
      }
    }
    this.storeData(data);
  },

  /* Public API */
  setup: function() {
    /* to be overridden */
  },

  requestData: function() {
    /* to be overriden */
  },

  storeData: function(data) {
    /* to be overriden */
  },

  // low-level I/O
  read: function() {
    // TODO implement a policy for reading data
    return this.model.readData();
  },

  write: function(data) {
    var access = this.model.def.storage.access;
    var stored;

    if (access && access.type) {
      var signature = data[access.signature];
      this._queued_data[signature] = data;
      while (this._queue) {
        var next = this._queue[0];
        if (next in this._queued_data) {
          data = this._queued_data[next];
          stored = this._storeFields(data);
          this._queue.shift();
        } else {
          break;
        }
      }
    } else {
      stored = this._storeFields(data);
    }
    return stored;
  },

  _storeFields: function(data) {
    // filter out fields with the wrong data type
    var schema = this.model.schema;
    var new_data = new Object();
    var current_data = this.read();
    schema.each(function(f) {
      var field = f.key;
      var value = data[field];
      if (typeof value == f.value) {
        new_data[field] = value;
      } else {
        new_data[field] = current_data[field];
      }
    });
    if (!this._data || !this._compareData(this.read(), new_data)) {;
      this.model.writeData(new_data);
      CPSSkins.notify('stored', {'publisher': this});
    }
    return new_data;
  },

  _compareData: function(a, b) {
    return JSON.stringify(a) == JSON.stringify(b);
  },

  merge: function(data) {
    var current_data = this.read();
    var new_data = $H(current_data).merge(data);
    this.write(new_data);
  }

}

CPSSkins.registerStorages({

  ram: function(model) {
    return new CPSSkins.RAMStorage(model);
  },

  local: function(model) {
    return new CPSSkins.LocalStorage(model);
  },

  remote: function(model) {
    return new CPSSkins.RemoteStorage(model);
  },

  unified: function(model) {
    return new CPSSkins.UnifiedStorage(model);
  }

});

CPSSkins.RAMStorage = Class.create();
CPSSkins.RAMStorage.prototype = Object.extend(
  new CPSSkins.StorageAdapter(), {

  requestData: function() {
    /* nothing to do since the data is already there */
    this.write(this.read());
  },

  storeData: function(data) {
    /* Store the data directly */
    this.write(data);
  }

});

CPSSkins.LocalStorage = Class.create();
CPSSkins.LocalStorage.prototype = Object.extend(
  new CPSSkins.StorageAdapter(), {

  setup: function() {
    this.id = this.model.def.storage.id;
    this.cookie_name = 'cpsskins_local_storage_' + this.id;
  },

  requestData: function() {
    var results = document.cookie.match(this.cookie_name + '=(.*?)(;|$)');
    if (results) {
      var value = unescape(results[1]);
      data = JSON.parse(value);
      this.write(data);
    } else {
      return;
    }
  },

  storeData: function(data) {
    var stored_data = this.write(data);
    value = escape(JSON.stringify(stored_data));
    document.cookie = this.cookie_name + '=' + value + '; path=/';
  }

});

CPSSkins.RemoteStorage = Class.create();
CPSSkins.RemoteStorage.prototype = Object.extend(
  new CPSSkins.StorageAdapter(), {

  requestData: function() {
    var model = this.model;
    var storage = this;

    var url = model.def.storage.accessors.get;
    if (!url) return;
    var options = {
      onComplete: function(req) {
        var content_type = req.getResponseHeader('content-type');
        if (content_type.match(/^text\/x-json/)) {
          var data = JSON.parse(req.responseText);
          storage.write(data);
        }
      }
    }
    var parts = url.split('?');
    if (parts.length == 2) {
      url = parts[0];
      options.parameters = parts[1];
    }
    new Ajax.Request(url, options);
  },

  storeData: function(data) {
    var model = this.model;
    var storage = this;

    var url = model.def.storage.accessors.set;
    if (!url) return;
    new Ajax.Request(url, {
      method: "post",
      parameters: $H({
        "data": JSON.stringify(data)
        }).toQueryString(),
      onComplete: function(req) {
        var content_type = req.getResponseHeader('content-type');
        if (content_type.match(/^text\/x-json/)) {
          var data = JSON.parse(req.responseText);
          storage.write(data);
        }
      }
    });
  }

});

CPSSkins.UnifiedStorage = Class.create();
CPSSkins.UnifiedStorage.prototype = Object.extend(
  new CPSSkins.StorageAdapter(), {

  setup: function() {
    var models = [];
    var storage = this;

    // merge the data from all storages
    CPSSkins.registerEventHandler('stored', storage, function(event) {
      event.subscriber.merge(event.publisher.read());
      // propagate the event
      CPSSkins.notify('stored', {'publisher': storage});
    });

    this.model.def.storage.units.each(function(p) {
      var model = CPSSkins.getModelById(p);
      models.push(model);
      CPSSkins.subscribe('stored',
        {'subscriber': storage, 'publisher': model.storage}
      );
    });
    this.models = models;
  },

  requestData: function() {
    var model = this.model;
    this.models.each(function(m) {
      m.storage.requestData();
    });
  },

  storeData: function(data) {
    var model = this.model;
    this.models.each(function(m) {
      m.storage.storeData(data);
    });
  }
});


// View

CPSSkins.View = function() {};
CPSSkins.View.prototype = {

  initialize: function(widget, def) {
    this.widget = widget;
    this.def = def;
    this._visible = false;
    this._displayed = true;

    this.setup();
  },

  hash: function() {
    return this.def.id;
  },

  /* Public API */
  inspect: function() {
    return "[CPSSkins " + this.def.widget + "]";
  },

  setup: function() {
    /* to override: setup the view */
  },

  render: function(data) {
    /* to override: render the view from the data */
  },

  prepare: function() {
    /* to override: prepare the widget before showing it */
  },

  teardown: function() {
    /* to override: tear down the widget after hiding it */
  },

  /* Private API */
  getControllers: function() {
    return this.def.controllers || []
  },

  attachControllers: function() {
    var view = this;
    var view_id = view.hash();
    var controllers_ids = view.getControllers();
    controllers_ids.each(function(c) {
      var controller = CPSSkins.getControllerById(c);
      if (controller) {
        controller.views.add(view_id);
        controller.unregister(view);
        controller.register(view);
        controller.update(view);
      }
    });
  },

  observe: function(model) {
    model.addObserver(this);
    this.model = model;
  },

  stopObserving: function() {
    if (this.model) {
      this.model.removeObserver(this);
    }
  },

  getData: function() {
    if (this.model) {
      return this.model.getData();
    }
  },

  readData: function() {
    if (this.model) {
      return this.model.readData();
    }
  },

  refresh: function() {
    if (!this._visible) return;
    var data = this.readData();
    if (data) {
      this.display(data);
    }
  },

  reload: function() {
    var data = this.getData();
    if (data) {
      this.display(data);
    }
  },

  display: function(data) {
    this.render(data);
    if (this.def.render_effect) {
      $(this.widget).hide();
      this.applyEffect(this.def.render_effect)
    }
  },

  focus: function() {
    CPSSkins.notify("gained focus", {'publisher': this,
                                     'context': this.selected});
  },

  defocus: function() {
    CPSSkins.notify("lost focus", {'publisher': this});
  },

  show: function() {
    if (this._visible || !this._displayed) return;
    var widget = $(this.widget);

    this._visible = true;

    // refresh the view
    this.refresh();

    // prepare the view
    this.prepare();

    if (this.def.show_effect) {
      this.applyEffect(this.def.show_effect)
    } else {
      widget.show();
    }
  },

  hide: function() {
    if (!this._visible) return;
    var widget = $(this.widget);

    if (this.def.hide_effect) {
      this.applyEffect(this.def.hide_effect);
    } else {
      widget.hide();
    }
    // tear down the view;
    this.teardown();
    this._visible = false;
  },

  applyEffect: function(options) {
    if (this.effect) {
      this.effect.stop();
    }
    var widget = this.widget;
    if (options.transition in CPSSkins.Effects) {
      if (widget.style.display == "none") {
        widget.style.display = "";
      }
      this.effect = CPSSkins.Effects[options.transition](widget, options)
    }
  }

}

// Widgets
CPSSkins.registerWidgets({

  area: function(def) {
    var widget = $(def.widget.area);
    return new CPSSkins.AreaWidget(widget, def);
  },

  custom: function(def) {
    var widget = CPSSkins.Canvas.createNode({
      tag: "div"
    });
    return new CPSSkins.CustomWidget(widget, def);
  },

  contextmenu: function(def) {
    var widget = CPSSkins.Canvas.createNode({
      tag: "div",
      classes: "contextMenu",
      style: {position:"absolute", display:"none"}
    });
    return new CPSSkins.ContextualMenu(widget, def);
  },

  contextactions: function(def) {
    var widget = CPSSkins.Canvas.createNode({
      tag: "div",
      classes: "contextActions",
      style: {position:"absolute", display:"none"}
    });
    return new CPSSkins.ContextualActions(widget, def);
  },

  tooltip: function(def) {
    var widget = CPSSkins.Canvas.createNode({
      tag: "div",
      classes: "tooltip",
      style: {position: "absolute", display: "none"}
    });
    return new CPSSkins.Tooltip(widget, def);
  },

  panel: function(def) {
    var widget = CPSSkins.Canvas.createNode({
      tag: "div",
      style: {display: "none"}
    });
    return new CPSSkins.Panel(widget, def);
  }
});

// Node widget
CPSSkins.AreaWidget = Class.create();
CPSSkins.AreaWidget.prototype = Object.extend(new CPSSkins.View(), {

  inspect: function() {
    return "[Area Widget " + this.def.widget.area + "]";
  }

});

// Custom widget
CPSSkins.CustomWidget = Class.create();
CPSSkins.CustomWidget.prototype = Object.extend(new CPSSkins.View(), {

  setup: function() {

    var url = this.def.widget.template;
    var view = this;

    if (url) {
      var options = {
        onComplete: function(req) {
          view.source = req.responseText;
          CPSSkins.notify("loaded template",
            {'publisher': view, 'scope': view.hash()}
          );
        }
      }
      new Ajax.Request(url, options);

      CPSSkins.registerEventHandler("loaded template", view, function(event) {
        var view = event.subscriber;
        view.reload();
        CPSSkins.unsubscribe("loaded template", {'scope': view.hash()});
      });

      CPSSkins.subscribe("loaded template",
        {'subscriber': view, 'scope': view.hash()}
      );
    }

    this._visible = true;
  },

  inspect: function() {
    return "[Widget " + this.def.widget.template + "]";
  },

  render: function(data) {
    if (this.source) {
      var node = document.createElement("div");
      node.innerHTML = this.source;
      ctal.process_ctal(node, data);
      this.widget.innerHTML = node.innerHTML;
      this.attachControllers();
    }
  }

});

// Panels

CPSSkins.Panel = Class.create();
CPSSkins.Panel.prototype = Object.extend(new CPSSkins.View(), {

  inspect: function() {
    return '[CPSSkins Panel]';
  },

  render: function(data) {
    var url = data.url;
    if (!url) {
      return;
    }
    var script = data.script;
    if (script) {
      this.script_id = this.def.model;
      CPSSkins.Canvas.addScript(this.script_id, script);
    }

    var css = data.css;
    if (css) {
      this.css_id = this.def.model;
      CPSSkins.Canvas.addStyleSheet(this.css_id, css);
    }

    var view = this;
    if (url) {
      var widget = this.widget;
      var model = this.model;
      var view = this;
      var options = {
        method: "post",
        onComplete: function(req) {
          var text = req.responseText;
          if (widget.innerHTML != text) {
            widget.innerHTML = text;
          }
          CPSSkins._parse(widget);
          view.attachControllers();
        }
      };

      var parts = url.split('?');
      var method = url;
      if (parts.length == 2) {
        method = parts[0];
      }
      var form_data = $H(data.form) || {};
      if (form_data.keys().length > 0) {
        options.parameters = form_data.toQueryString();
      }
      new Ajax.Request(method, options);
    }
  },

  teardown: function() {
    if (this.css_id) {
      CPSSkins.Canvas.removeStyleSheet(this.css_id);
    }
    if (this.script_id) {
      CPSSKins.Canvas.removeScript(this.script_id);
    }
  }

});

// Contextual menu
CPSSkins.ContextualMenu = Class.create();
CPSSkins.ContextualMenu.prototype = Object.extend(new CPSSkins.View(), {

  setup: function() {
    var showEvent = this.showEvent = this.showEvent.bindAsEventListener(this);
    this.hideEvent = this.hideEvent.bindAsEventListener(this);
    this.callEvent = this.callEvent.bindAsEventListener(this);
    this.mouseOverEvent = this.mouseOverEvent.bindAsEventListener(this);

    Event.observe(this.widget, "mousedown", function(e) {Event.stop(e)});
    Event.observe(this.widget, "mouseup", this.callEvent);
    Event.observe(this.widget, "mouseover", this.mouseOverEvent);
    Event.observe(document, "mousedown", this.hideEvent);

    $A(this.def.selectors || []).each(function(s) {
      $$(s).each(function(el) {
        Event.observe(el, "mouseup", showEvent);
        el.oncontextmenu = function(e) { return false };
      });
    });
  },

  render: function(data) {
    this.widget.innerHTML = '';
    this._renderFragment(this.widget, this.def.widget, data);
  },

  _getSubmenu: function(element) {
    if (!element) return null;
    var nodes = element.childNodes;
    for (var i=0;i<nodes.length;i++) {
      var node = $(nodes[i]);
      if (node.nodeType != 1) continue;
      if (!node.hasClassName("submenu")) continue;
      return node;
    }
    return null;
  },

  _renderFragment: function(container, fragment, data) {

    var createNode = CPSSkins.Canvas.createNode;
    fragment.items.each(function(item) {

      var type = item.type;
      var visible = item.visible;
      var disabled = false;
      if (data && visible) {
        if (!data[visible]) disabled = true;
      }

      switch (type) {

        case "item": {
          var options = {
            tag: "a",
            style: {display: "block"},
            classes: [],
            attributes: {
              action: item.action,
              href: "javascript:void(0)"
            }
          }

          var confirm = item.confirm;
          if (confirm && !disabled) {
            options.attributes.confirm = confirm;
          }

          if (disabled) {
            options.attributes.disabled = true;
            options.classes.push("disabled");
          }
          var a = createNode(options);

          var icon = disabled ? "noicon.png": (item.icon || "noicon.png");
          a.appendChild(createNode({
            tag: "img",
            attributes: {
              "src": icon,
              "alt": "*"
            }
          }));

          container.appendChild(a);
          a.appendChild(document.createTextNode(item.label));

          break;
        };

        case "selection": {
          if (!data) return;
          var choices = item.choices;
          (data[choices] || []).each(function(s) {
            var options = {
              tag: "a",
              style: {display: "block"},
              attributes: {
                action: item.action,
                choice: s.choice,
                href: "javascript:void(0)"
              }
            }
            var a = createNode(options);

            var icon = disabled ? "noicon.png": (item.icon || "noicon.png");
            a.appendChild(createNode({
              tag: "img",
              attributes: {
                "src": icon,
                "alt": "*"
              }
            }));

            container.appendChild(a);
            a.appendChild(document.createTextNode(s.label));
          });
          break;
        };

        case "separator": {
          var node = createNode({
            tag: "div",
            classes: "separator"
          });
          container.appendChild(node);
          break;
        };

        case "submenu": {
          var options = {
            tag: "a",
            classes: "submenuitem",
            style: {display: "block"},
            attributes: {href:"javascript:void(0)"}
          };

          if (disabled) { options.classes = "disabled"; }
          var submenuitem = container.appendChild(createNode(options));

          var icon = item.icon || "noicon.png";
          submenuitem.appendChild(createNode({
            tag: "img",
            attributes: {
              "src": icon,
              "alt": "*"
            }
          }));

          if (!this.submenuLeft) {
            this.submenuLeft = $(this.widget).getDimensions().width -2;
          }

          var submenu = createNode({
            tag: "div",
            classes: "submenu",
            style: {
              position: "absolute",
              left: this.submenuLeft + "px",
              display: "none",
              margin: "-20px 0 0 0"
            }
          });
          submenuitem.appendChild(document.createTextNode(item.label));
          submenuitem.appendChild(submenu);

          this._renderFragment(submenu, item, data);

          break;
        };
      }
    }.bind(this));
  },

  prepare: function() {
    var selected = this.selected;
    if (!selected) return;

    // Display the menu inside the screen
    var widget = this.widget;
    widget.moveTo({'x': this.mouseX, 'y': this.mouseY});
    widget.fitInsideScreen();
  },

  /* Event handlers */
  showEvent: function(e) {
    if (Event.isLeftClick(e)) return;
    var element = Event.element(e);
    var selected = CPSSkins.Identifiable.getIdentifiable(element);
    if (!selected) return;

    this.mouseX = Event.pointerX(e);
    this.mouseY = Event.pointerY(e);

    var widget = this.widget;

    this.selected = selected;
    this._displayed = true;
    this.focus();
    this.show();
  },

  hideEvent: function(e) {
    this._displayed = false;
    this.defocus();
    this.hide();
  },

  callEvent: function(e) {
    var element = Event.element(e);
    if (element.getAttribute("disabled")) return;
    var action = element.getAttribute("action");
    if (!action) return;
    var choice = element.getAttribute("choice") || action;
    var confirm = element.getAttribute("confirm");
    this.hide();
    if (confirm) {
      if (!window.confirm(confirm)) return;
    }
    /* notify the controller to take action */
    var info = {
      "target": this.selected,
      "publisher": this,
      "subscriber": this.controller,
      "options": {'action': action, 'choice': choice}
    }
    CPSSkins.notify("command", info);
    Event.stop(e);
  },

  mouseOverEvent: function(e) {
    var here = Event.element(e);
    if ($(here).hasClassName("submenuitem")) {
      var menu = this._getSubmenu(here);
      if (!menu) return;

      document.getElementsByClassName("submenu", here.parentNode).each(
        function(v) {
          $(v).hide();
        }
      );
      $(menu).show();
    }
  }
});


// Contextual actions
CPSSkins.ContextualActions = Class.create();
Object.extend(CPSSkins.ContextualActions.prototype,
              CPSSkins.ContextualMenu.prototype);
Object.extend(CPSSkins.ContextualActions.prototype, {

  _renderFragment: function(container, fragment, data) {
    var createNode = CPSSkins.Canvas.createNode;
    fragment.items.each(function(item) {
      if (item.type != "item") return;
      var visible = item.visible;
      var disabled = false;
      if (data && visible) {
        if (!data[visible]) return;
     }
      var options = {
        tag: "a",
        style: {display: "block"},
        classes: [],
        attributes: {
          action: item.action,
          href: "javascript:void(0)"
        }
      }

      var confirm = item.confirm;
      if (confirm && !disabled) {
        options.attributes.confirm = confirm;
      }

      var a = createNode(options);
      var icon = disabled ? "noicon.png": (item.icon || "noicon.png");
      a.appendChild(createNode({
        tag: "img",
        attributes: {
          "src": icon,
          "alt": "*"
        }
      }));

      container.appendChild(a);
      a.appendChild(document.createTextNode(item.label));
    });
  },

});


// Tooltip
CPSSkins.Tooltip = Class.create();
CPSSkins.Tooltip.prototype = Object.extend(new CPSSkins.View(), {

  setup: function() {
    var showEvent = this.showEvent = this.showEvent.bindAsEventListener(this);
    var hideEvent = this.hideEvent = this.hideEvent.bindAsEventListener(this);
    this.moveEvent = this.moveEvent.bindAsEventListener(this);
    $A(this.def.selectors || []).each(function(s) {
      $$(s).each(function(e) {
        Event.observe(e, "mouseover", showEvent);
        Event.observe(e, "mouseout", hideEvent);
      });
    });
  },

  render: function(data) {
    this.widget.innerHTML = data.hint;
  },

  prepare: function() {
    this.widget.moveTo({'x': this.mouseX, 'y': this.mouseY +10});
    this.widget.fitInsideScreen();
  },

  /* Event handlers */
  showEvent: function(e) {
    var selected = $(Event.element(e));

    var model = CPSSkins.Canvas.getModel(selected);
    if (!model) return;

    var data = model.readData();
    if (!data) return;
    if (data.hint == null) return;

    this.mouseX = Event.pointerX(e);
    this.mouseY = Event.pointerY(e);
    this.selected = selected;

    if (this.def.widget.follow) {
      Event.observe(document, "mousemove", this.moveEvent);
    }

    this._displayed = true;
    this.focus();
    this.show();
    Event.stop(e);
  },

  moveEvent: function(e) {
    var mouseX = Event.pointerX(e);
    var mouseY = Event.pointerY(e);
    this.widget.moveTo({'x': mouseX+10, 'y': mouseY+10});
    Event.stop(e);
  },

  hideEvent: function(e) {
    var selected = Event.element(e);
    if (selected != this.selected) return;

    if (this.def.widget.follow) {
      Event.stopObserving(document, "mousemove", this.moveEvent);
    }

    this._displayed = false;
    this.defocus();
    this.hide();
    Event.stop(e);
  }

});

