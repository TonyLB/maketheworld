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