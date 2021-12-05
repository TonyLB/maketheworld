export const getCharacters = ({ charactersInPlay }) => {
    return new Proxy(charactersInPlay || {}, {
        get: (obj, prop) => ((obj && obj[prop] && {
            Name: '????',
            ...obj[prop]
        }) || { Name: '????' })
    })
}
