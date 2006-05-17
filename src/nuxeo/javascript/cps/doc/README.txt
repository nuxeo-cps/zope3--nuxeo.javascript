======================
CPS Javascript Library
======================

CPS.Version
-----------

return library version number

Helpers
_______

CPS.setAction(elementId, callable)
==================================

Set the callable as the action when `elementId` is clicked.

CPS.unSetAction(elementId, callable)
====================================

Unset the callable

function $$(className)
======================

return a collection of element that have the given class name

CPSEvents
---------

An event manager

CPSEvents.observeEvent(event_id, observer_id, observer_listener)
================================================================

Oserve the `observer_id` element, for `event_id`, with the `observer_listener`
callable

CPSEvents.purgeObservers()
==========================

Purge all observers

CPSEvents.triggerEvent(event_id)
================================

Trigger the `event_id`

CPS.Effects
-----------

Gathers all Effects

CPS.Effects.changeClass(fromClass, toClass)
===========================================

Change a class to another, for all elements that match the class

CPS.Effects.hideClass(className)
================================

Hide all elements that match the class, with a nice fade out

CPS.Effects.showClass(className)
================================

Show all elements that match the class, with a nice fade in

CPS.Effects.setMouseOver(elementId)
===================================

Set the hand cursor, on mouse hover the `elementId` element,
not matter the browser type.

CPS.Effects.setMouseOver(elementId)
===================================

Unset the hand cursor

CPS.Events.addClassEffect(triggerId, fromClass, toClass)
========================================================

Add a changeClass() action linked to a `triggerId` element

CPS.Cookies
-----------

Cookies handler

CPS.Cookies.set(name, value)
============================

Set the cookie with the given value

CPS.Cookies.get(name)
=====================

Get the cookie `name`

CPS.Cookies.del(name)
=====================

Delete the cookie `name`

