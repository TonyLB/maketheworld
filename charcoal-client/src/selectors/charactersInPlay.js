export const getCharactersInPlay = ({ charactersInPlay }) => {
    const { meta, ...rest } = charactersInPlay
    return rest
}

export const getCharactersInPlayFetchNeeded = ({ charactersInPlay }) => (!(charactersInPlay && charactersInPlay.meta && (charactersInPlay.meta.fetching || charactersInPlay.meta.fetched)))
