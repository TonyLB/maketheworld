---
---

# Internal Cache

For the moment, the internal cache library package is **only** a space for experimentation.  While it demonstrates some
example mix-in constructs for internal caches, those constructs (to date) need to rely upon **static literal** class
properties.  That makes it impossible (in the current formulation) to make a generic mixin function for (e.g.) passing
a property name and a lookup function, and extending the class to store the outputs of that lookup on that specified
property name.

Someday!

---
