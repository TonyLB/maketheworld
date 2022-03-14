import { PersonalAssetsPublic } from './baseClasses'

export type PublicSelectors = {
    getCurrentWML: (state: PersonalAssetsPublic) => string;
}

export const publicSelectors: PublicSelectors = {
    getCurrentWML: (state) => (state.wmlQuery?.('')?.source() || '')
}