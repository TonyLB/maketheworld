export const getMyCharacters = ({ myCharacters }) => (myCharacters && myCharacters.data)

export const getMyCharacterByName = (searchName) => ({ myCharacters }) => {
    const { data = [] } = myCharacters || {}
    const matchingCharacters = data.filter(({ Name }) => (Name === searchName))
    if (!matchingCharacters) {
        return {}
    }
    return matchingCharacters[0]
}

export const getMyCharacterById = (searchId) => ({ myCharacters }) => {
    const { data = [] } = myCharacters || {}
    const matchingCharacters = data.filter(({ CharacterId }) => (CharacterId === searchId))
    if (!matchingCharacters) {
        return {}
    }
    return matchingCharacters[0]
}

export const getMyCurrentCharacter = () => (state) => {
    const { connection }  = state || {}
    const { characterId } = connection || {}
    if (characterId) {
        return getMyCharacterById(characterId)(state)
    }
    else {
        return {}
    }
}

export const getMyCharacterFetchNeeded = ({ myCharacters }) => (!(myCharacters && myCharacters.meta && (myCharacters.meta.fetching || myCharacters.meta.fetched)))
