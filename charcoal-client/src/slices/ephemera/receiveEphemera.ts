import { PayloadAction } from '@reduxjs/toolkit'
import { EphemeraCharacterInPlay, EphemeraCharacterColor } from './baseClasses'

export type CharacterInPlayChange = Omit<EphemeraCharacterInPlay, "color"> & {
    type: 'CharacterInPlay';
}

export type EphemeraChange = CharacterInPlayChange

const colorSequence: EphemeraCharacterColor[] = ['pink', 'purple', 'green']
    .map(color => ({
        name: color,
        primary: color,
        light: `light${color}`,
        recap: `recap${color}`,
        recapLight: `recapLight${color}`,
        direct: `direct${color}`
    }))

export const receiveEphemera = (state: any, action: PayloadAction<EphemeraChange>) => {
    if (action.payload.type === 'CharacterInPlay') {
        const { CharacterId, Name, Connected, RoomId } = action.payload
        const nextColorIndex = (Object.values(state.charactersInPlay).length + 2) % 3
        state.charactersInPlay[CharacterId] = {
            CharacterId,
            Name,
            Connected,
            RoomId,
            color: state.charactersInPlay[CharacterId]?.color || colorSequence[nextColorIndex]
        }
    }
}

export default receiveEphemera
