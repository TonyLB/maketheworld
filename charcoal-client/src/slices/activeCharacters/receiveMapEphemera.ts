import { PayloadAction } from '@reduxjs/toolkit'
import { EphemeraCharacterId, EphemeraMapId } from '@tonylb/mtw-interfaces/dist/baseClasses';
import { ActiveCharacterMap } from './baseClasses'

export type ActiveCharacterMapChange = (ActiveCharacterMap & {
    type: 'MapUpdate';
    active: true;
    targets: EphemeraCharacterId[];
}) | {
    type: 'MapUpdate';
    active: false;
    MapId: EphemeraMapId;
    targets: EphemeraCharacterId[];
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
