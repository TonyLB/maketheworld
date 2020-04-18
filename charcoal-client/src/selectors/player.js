export const getConsentGiven = ({ player }) => ( player && player.CodeOfConductConsent)

export const getPlayerFetched = ({ player }) => ((player && player.PlayerName) ? true : false)
