/*

 Copyright (c) 2006 Balazs Ree <ree@ree.hu>
 All Rights Reserved.

 This software is subject to the provisions of the Zope Public License,
 Version 2.1 (ZPL).  A copy of the ZPL should accompany this distribution.
 THIS SOFTWARE IS PROVIDED "AS IS" AND ANY AND ALL EXPRESS OR IMPLIED
 WARRANTIES ARE DISCLAIMED, INCLUDING, BUT NOT LIMITED TO, THE IMPLIED
 WARRANTIES OF TITLE, MERCHANTABILITY, AGAINST INFRINGEMENT, AND FITNESS
 FOR A PARTICULAR PURPOSE.

 2006-02-11: bug fixes - Jean-Marc Orliaguet <jmo@chalmers.se>

*/


ctal = {
  Version: '0.1'
}

/* exception handling */

ctal.exceptionFactory = function(name, prefix) {
  var exc = function (msg) {
    var fullmsg = prefix + msg;
    var err = new Error(fullmsg);
    // take care of IE5/5.5
    if (!err.message) {
      err.message = fullmsg;
    }
    err.name = name;
    return err
  }
  return exc
}

ctal.TALError = ctal.exceptionFactory("TALError", "TAL error: ");

ctal.TALESError = ctal.exceptionFactory("TALESError", "TAL expression error: ");

/* DOM manipulation utilities */

ctal.node_insertbefore = function(parent, value, marker) {
  var nodes = new Array();
  if (value != null) {
    // decide if we are a DomNode or a DomNodeList
    if (typeof value.nodeName == "undefined") {
      // a DomNodeList
      for (var i=0; i<value.length; i++) {
        nodes[i] = value[i];
      }
    } else {
      nodes[0] = value;
    }
  }
  for (var i=0; i<nodes.length; i++) {
    var node = nodes[i]; 
    if (marker) {
      parent.insertBefore(node, marker);
    } else {
      parent.appendChild(node);
    }
  }
}

ctal.node_replace = function(value, old) {
  var parent = old.parentNode;
  var nextsibling = old.nextSibling;
  if (parent) {;
    parent.removeChild(old);
    ctal.node_insertbefore(parent, value, nextsibling);
  }
}

ctal.node_replacechildren = function(value, old) {
  while (old.firstChild) {
    old.removeChild(old.firstChild);
  }
  ctal.node_insertbefore(old, value, null);
}

/* TAL handlers */

ctal.tal_attributes = function(tmpl, value, data) {
  var attrs = value.split(";");
  for (var i=0; i<attrs.length; i++) {
    var attr = ctal.trim(attrs[i]);
    if (!attr) continue;
    var nmx = ctal.get_nameexpr(attr);
    var aname = nmx[0]
    var avalue = ctal.eval_expr(data, nmx[1])
    var newattr = tmpl.ownerDocument.createAttribute(aname);
    newattr.value = avalue;
    tmpl.setAttributeNode(newattr);
  }
}

ctal.content_or_replace  = function(tmpl, expr, data, func) {
  var qual, value, newnode;
  var colpos = expr.indexOf(' ')
  if (colpos > -1) {
    qual = expr.substring(0, colpos);
  }
  if (colpos > -1 && qual.indexOf(':') == -1) {
    value = expr.substring(colpos + 1);
  } else {
    qual = null;
    value = expr;
  }
  var evalue = ctal.eval_expr(data, value);
  if (qual == 'dom') {
    newnode = evalue;
  } else if (qual == null) {
    newnode = tmpl.ownerDocument.createTextNode(evalue);
  } else {
    throw new ctal.TALESError('TALES Expression qualifier "' + qual + 
                              '" is not implemented')
  }
  func(newnode, tmpl);
}

ctal.tal_content = function(tmpl, value, data) {
  ctal.content_or_replace(tmpl, value, data, ctal.node_replacechildren);
}

ctal.tal_replace = function(tmpl, value, data) {
  ctal.content_or_replace(tmpl, value, data, ctal.node_replace);
}

ctal.tal_condition = function(tmpl, value, data) {
  var cond = ctal.eval_expr(data, value)
  if (! ctal.isTrue(cond)) {
    tmpl.parentNode.removeChild(tmpl);
  }
}

ctal.tal_omit_tag = function(tmpl, value, data) {
  var cond = ctal.eval_expr(data, value);
  if (ctal.isTrue(cond)) {
    ctal.node_replace(tmpl.childNodes, tmpl);
  }
}

ctal.tal_repeat = function(tmpl, value, data) {
  var nmx = ctal.get_nameexpr(value);
  var datas;
  try {
    datas = ctal.eval_expr(data, nmx[1]);
  } catch (e) {
    if (e.name == ctal.TALESError.name) {
      throw new ctal.TALError(nmx[1]+" is not an Array.")
    } else {
      throw e
    }
  }

  var parent = tmpl.parentNode;
  if (!parent) return;
  var marker = tmpl.nextSibling;

  // the iterator variable has the same name as the looped through array.
  if (nmx[0] == nmx[1]) {
    throw new ctal.TALError(nmx[0] +
      " iterator variable overwrites loop variable.");
  }

  // do a deep copy of the data structure traversed by the repeat loop
  // to avoid corrupting it.
  var saved_data = ctal.deepcopy(data);
  for (var i=0; i<datas.length; i++) {
    data[nmx[0]] = datas[i];

    var newnode = tmpl.cloneNode(true);
    ctal.node_insertbefore(parent, newnode, marker);
    // recurse
    ctal.process_ctal(newnode, data);
    data = ctal.deepcopy(saved_data);
  }
  parent.removeChild(tmpl);
}

/* general processor */

ctal.process_ctal = function(tmpl, data) {
  var recurse = true;
  var parsers, ctal_attr, ctal_attr_name, attr;
  if (tmpl.nodeType == 1) {
    parsers = ctal.parsers;
    for (ctal_attr in parsers) {
      ctal_attr_name = "ctal:" + ctal_attr;
      attr = tmpl.getAttribute(ctal_attr_name);
      if (attr != null) {
        tmpl.removeAttribute(ctal_attr_name);
        // For Opera
        tmpl.removeAttribute(ctal_attr);
        var parser = parsers[ctal_attr];
        if (!parser.recurse) {
          recurse = false;
        }
        parser.parse(tmpl, attr, data)
      }
    }
  }
  //  recursion
  if (recurse) {
    for (var i=0; i<tmpl.childNodes.length; i++) {
      ctal.process_ctal(tmpl.childNodes[i], data);
    }
  }
}

/* expression handling */

ctal.eval_expr = function(data, expr) {
  var colpos = expr.indexOf(':')
  var etype, value;
  if (colpos > -1) {
    etype = expr.substring(0, colpos);
    etype = etype.split(' ').join(' ');
    value = expr.substring(colpos + 1);
  } else {
    etype = 'path';
    value = expr;
  }
  if (etype == 'string') {
    return value
  } else if (etype == 'path') {
    return ctal.eval_pathexpr(data, value)
  } else if (etype == 'not') {
    return !ctal.eval_pathexpr(data, value)
  } else if (etype == 'javascript') {
    // evaluate the expression in context
    with (data) { return eval(value) };
  } else {
    throw new ctal.TALESError('TALES Expression type "' + etype + 
                              '" is not implemented')
  }
}

ctal.eval_pathexpr = function(data, path) {
  var pathelems = path.split("/");
  var traverse = data;
  for (var i=0; i < pathelems.length; i++) {
    traverse = traverse[pathelems[i]];
    if (typeof traverse == "undefined") {
       throw new ctal.TALESError('No data found for "' + path + '"')
    }
  }
  return traverse;
}

ctal.get_nameexpr = function(value) {
  var splitnx = ctal.trim(value).split(/ /);
  return [ctal.trim(splitnx[0]), ctal.trim(splitnx.slice(1).join(' '))];
}

ctal.trim = function(text) {
  return text.replace(/^\s+|\s+$/g, "");
}

ctal.deepcopy = function(obj) {
  var clone = new obj.constructor();
  for (var i in obj) {
    if (typeof obj[i] == "object") {
      clone[i] = ctal.deepcopy(obj[i]);
    } else {
      clone[i] = obj[i];
    }
  }
  return clone;
}

ctal.isTrue = function(cond) {
  return cond && (cond != "")
}

// the parsing order matters
ctal.parsers = {
  "condition": {'parse': ctal.tal_condition, 'recurse': true},
  "repeat": {'parse': ctal.tal_repeat, 'recurse': false},
  "content": {'parse': ctal.tal_content, 'recurse': false},
  "replace": {'parse': ctal.tal_replace, 'recurse': false},
  "omit-tag": {'parse': ctal.tal_omit_tag, 'recurse': true},
  "attributes": {'parse': ctal.tal_attributes, 'recurse': true}
  };

