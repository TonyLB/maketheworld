import { ActiveCharacterPublic, ActiveCharacterMap } from './baseClasses'

export type PublicSelectors = {
    getActiveCharacterMaps: (state: ActiveCharacterPublic) => Record<string, ActiveCharacterMap>;
}

export const publicSelectors: PublicSelectors = {
    getActiveCharacterMaps: (state) => (state.maps),
}