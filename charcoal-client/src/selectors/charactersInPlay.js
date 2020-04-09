export const getCharactersInPlay = ({ charactersInPlay }) => {
    const { meta, ...rest } = charactersInPlay
    return rest
}

export const getActiveCharacterList = ({ charactersInPlay }) => {
    const { meta, ...rest } = charactersInPlay
    return Object.values(rest).filter(({ ConnectionId }) => (ConnectionId))
}

export const getCharactersInPlayFetchNeeded = ({ charactersInPlay }) => (!(charactersInPlay && charactersInPlay.meta && (charactersInPlay.meta.fetching || charactersInPlay.meta.fetched)))
