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
    if (action.payload.active) {
        const { MapId, name, rooms, assets, fileURL } = action.payload
        state.maps[MapId] = {
            name,
            rooms,
            assets,
            fileURL
        }    
    }
    else {
        delete state.maps[action.payload.MapId]
    }
}

export default receiveMapEphemera
