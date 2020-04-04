export const getCharacters = ({ characters }) => (characters && characters.data)

export const getCharacterByName = (searchName) => ({ characters }) => {
    const { data = [] } = characters || {}
    const matchingCharacters = data.filter(({ Name }) => (Name === searchName))
    if (!matchingCharacters) {
        return {}
    }
    return matchingCharacters[0]
}

export const getCharacterFetchNeeded = ({ characters }) => (!(characters && characters.meta && (characters.meta.fetching || characters.meta.fetched)))
