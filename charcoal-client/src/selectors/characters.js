export const getCharacters = ({ characters }) => {
    return new Proxy(characters, {
        get: (obj, prop) => ((obj && obj[prop]) || { Name: '????' })
    })
}
