export const getCharacters = ({ characters }) => (characters && characters.data)

export const getCharacterFetchNeeded = ({ characters }) => (!(characters && characters.meta && (characters.meta.fetching || characters.meta.fetched)))
