import { PayloadAction } from '@reduxjs/toolkit'
import { LegalCharacterColor } from '@tonylb/mtw-interfaces/dist/baseClasses'
import { EphemeraClientMessageEphemeraUpdateCharacterInPlay } from '@tonylb/mtw-interfaces/dist/ephemera'
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
            const { Name, RoomId, fileURL, Color } = action.payload
            state.charactersInPlay[CharacterId] = {
                CharacterId,
                Name,
                RoomId,
                fileURL,
                color: colorTranslate(Color)
            }
        }
        else {
            state.charactersInPlay[CharacterId] = undefined
        }
    }
}

export default receiveEphemera
