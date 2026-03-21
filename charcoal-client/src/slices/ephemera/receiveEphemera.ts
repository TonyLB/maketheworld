import { PayloadAction } from '@reduxjs/toolkit'
import { LegalCharacterColor } from '@tonylb/mtw-interfaces/ts/baseClasses'
import { EphemeraClientMessageEphemeraUpdateCharacterInPlay } from '@tonylb/mtw-interfaces/ts/ephemera'
import { EphemeraCharacterColor } from './baseClasses'

export type CharacterInPlayChange = EphemeraClientMessageEphemeraUpdateCharacterInPlay

export type EphemeraChange = CharacterInPlayChange

const colorTranslate = (color: LegalCharacterColor): EphemeraCharacterColor => ({
    name: color,
    primary: color,
    light: `light${color}`,
    recap: `recap${color}`,
    recapLight: `recapLight${color}`,
    direct: `direct${color}`
})

export const receiveEphemera = (state: any, action: PayloadAction<EphemeraChange>) => {
    if (action.payload.type === 'CharacterInPlay') {
        const { CharacterId, Connected } = action.payload
        if (Connected) {
            const { DisplayName, RoomId, fileURL, Color } = action.payload
            state.charactersInPlay[CharacterId] = {
                CharacterId,
                DisplayName,
                RoomId,
                fileURL,
                color: colorTranslate(Color)
            }
        }
        else {
            delete state.charactersInPlay[CharacterId]
        }
    }
}

export default receiveEphemera
