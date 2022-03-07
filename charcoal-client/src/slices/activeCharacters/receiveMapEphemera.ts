import { PayloadAction } from '@reduxjs/toolkit'
import { ActiveCharacterMap } from './baseClasses'

export type ActiveCharacterMapChange = ActiveCharacterMap & {
    type: 'Map';
    CharacterId: string;
    MapId: string;
}

export type ActiveCharacterChange = ActiveCharacterMapChange

export const receiveMapEphemera = (state: any, action: PayloadAction<ActiveCharacterChange>) => {
    if (action.payload.type === 'Map') {
        const { MapId, Name, rooms } = action.payload
        state.maps[MapId] = {
            Name,
            rooms
        }
    }
}

export default receiveMapEphemera
