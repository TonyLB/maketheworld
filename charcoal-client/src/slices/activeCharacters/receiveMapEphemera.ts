import { PayloadAction } from '@reduxjs/toolkit'
import { ActiveCharacterMap } from './baseClasses'

export type ActiveCharacterMapChange = ActiveCharacterMap & {
    type: 'MapUpdate';
    targets: { characterId: string }[];
}

export type ActiveCharacterChange = ActiveCharacterMapChange

export const receiveMapEphemera = (state: any, action: PayloadAction<ActiveCharacterChange>) => {
    console.log(`ReceiveMapEphemera: Action: ${JSON.stringify(action, null, 4)}`)
    const { MapId, Name, rooms, fileURL } = action.payload
    state.maps[MapId] = {
        Name,
        rooms,
        fileURL
    }
}

export default receiveMapEphemera
