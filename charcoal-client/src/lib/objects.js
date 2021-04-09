export const reduceAssignToObject = (previous, item) => ({ ...previous, ...item })

//
// Applies map to the values of a key/value object
//
export const objectMap = (obj, transform) => Object.entries(obj)
    .map(([key, value]) => ({ [key]: transform(value) }))
    .reduce(reduceAssignToObject, {})

export const reduceArrayToObject = (previous, [key, value]) => ({ ...previous, [key]: value })

//
// Applies filter to the values of a key/value object
//
export const objectFilter = (obj, condition) => Object.entries(obj)
    .filter(([_, value]) => (condition(value)))
    .reduce(reduceArrayToObject, {})
