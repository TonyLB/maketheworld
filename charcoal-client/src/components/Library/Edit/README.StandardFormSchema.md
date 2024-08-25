---
---

# StandardFormSchema

StandardFormSchema context wrappers provide information to deeply nested edit components about the type of component
they are editing, and the precise field they are working in. Because there are different edit operations allowed upon
(for instance) a shortName field, vs. a description field (the latter permits links and conditions where the former does
not), edit components need to know this information. But, because it generally doesn't nest very deeply, it is not
appropriate to store the information in the (much more granular) EditSchema context.

---
---