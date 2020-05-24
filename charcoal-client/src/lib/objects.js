//
// Applies map to the values of a key/value object
//
export const objectMap = (obj, transform) => Object.entries(obj)
    .map(([key, value]) => ({ [key]: transform(value) }))
    .reduce((previous, item) => ({ ...previous, ...item }), {})

//
// Applies filter to the values of a key/value object
//
export const objectFilter = (obj, condition) => Object.entries(obj)
.filter(([_, value]) => (condition(value)))
.reduce((previous, [key, value]) => ({ ...previous, [key]: value }), {})
