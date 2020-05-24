//
// Applies map to the values of a key/value object
//
export const objectMap = (obj, transform) => Object.entries(obj)
    .map(([key, value]) => ({ [key]: transform(value) }))
    .reduce((previous, item) => ({ ...previous, ...item }), {})
