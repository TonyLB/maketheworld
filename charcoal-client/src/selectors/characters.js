export const getCharacters = ({ characters, grants }) => {
    return new Proxy(characters, {
        get: (obj, prop) => ((obj && obj[prop] && {
            Name: '????',
            ...obj[prop],
            Grants: (grants && grants[obj[prop].CharacterId]) || []
        }) || { Name: '????' })
    })
}
