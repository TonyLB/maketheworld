export const getMyCharacters = ({ myCharacters }) => (myCharacters && myCharacters.data)

export const getMyCharacterByName = (searchName) => ({ myCharacters }) => {
    const { data = [] } = myCharacters || {}
    const matchingCharacters = data.filter(({ Name }) => (Name === searchName))
    if (!matchingCharacters) {
        return {}
    }
    return matchingCharacters[0]
}

export const getMyCharacterFetchNeeded = ({ myCharacters }) => (!(myCharacters && myCharacters.meta && (myCharacters.meta.fetching || myCharacters.meta.fetched)))
