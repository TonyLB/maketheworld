import { PayloadAction } from '@reduxjs/toolkit'
import { EphemeraMapId } from '@tonylb/mtw-interfaces/dist/baseClasses';
import { ActiveCharacterMap } from './baseClasses'

export type ActiveCharacterMapChange = (ActiveCharacterMap & {
    type: 'MapUpdate';
    active: true;
    targets: { characterId: string }[];
}) | {
    type: 'MapUpdate';
    active: false;
    MapId: EphemeraMapId;
    targets: { characterId: string }[];
}

export type ActiveCharacterChange = ActiveCharacterMapChange

export const receiveMapEphemera = (state: any, action: PayloadAction<ActiveCharacterChange>) => {
    console.log(`ReceiveMapEphemera: Action: ${JSON.stringify(action, null, 4)}`)
    if (action.payload.active) {
        const { MapId, Name, rooms, fileURL } = action.payload
        state.maps[MapId] = {
            Name,
            rooms,
            fileURL
        }    
    }
    else {
        delete state.maps[action.payload.MapId.split('#')[1]]
    }
}

export default receiveMapEphemera
