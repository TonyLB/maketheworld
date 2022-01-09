export const getConsentGiven = ({ player }) => ( player && player.CodeOfConductConsent)

export const getPlayerFetched = ({ player }) => ((player && player.PlayerName) ? true : false)

export const getPlayer = ({ player }) => {
    const { PlayerName = '', CodeOfConductConsent = false, Characters = [] } = player || {}
    return {
        PlayerName,
        CodeOfConductConsent,
        Characters
    }
}

export const getMyCharacters = ({ player }) => {
    const { Characters = [] } = player || {}
    return Characters
}

export const getMyCharacterByKey = (key) => (state) => {
    const Characters = getMyCharacters(state)
    return Characters.find(({ scopedId }) => (scopedId === key))
}

export const getMyCharacterById = (key) => (state) => {
    const Characters = getMyCharacters(state)
    return Characters.find(({ CharacterId }) => (CharacterId === key))
}
