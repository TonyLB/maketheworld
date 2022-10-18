import { EphemeraMapId } from '@tonylb/mtw-interfaces/dist/baseClasses';
import { ActiveCharacterPublic, ActiveCharacterMap } from './baseClasses'

export type PublicSelectors = {
    getActiveCharacterMaps: (state: ActiveCharacterPublic) => Record<EphemeraMapId, ActiveCharacterMap>;
}

export const publicSelectors: PublicSelectors = {
    getActiveCharacterMaps: (state) => (state.maps),
}