export const objectMap = (object, callback) => {
    return Object.entries(object)
        .map(([key, value]) => ([key, callback(value)]))
        .reduce((previous, [key, value]) => ({
            ...previous,
            [key]: value
        }), {})
}
