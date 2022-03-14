import { PersonalAssetsPublic } from './baseClasses'
import { NormalForm } from '../../wml/normalize';

export type PublicSelectors = {
    getCurrentWML: (state: PersonalAssetsPublic) => string;
    getNormalized: (state: PersonalAssetsPublic) => NormalForm;
}

export const publicSelectors: PublicSelectors = {
    getCurrentWML: (state) => (state.wmlQuery?.('')?.source() || ''),
    getNormalized: (state) => (state.wmlQuery?.('')?.normalize() || {})
}