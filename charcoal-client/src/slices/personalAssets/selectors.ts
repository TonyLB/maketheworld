import { PersonalAssetsPublic } from './baseClasses'
import { WMLQuery } from '../../wml/wmlQuery'
import { NormalForm } from '../../wml/normalize';

export type PublicSelectors = {
    getCurrentWML: (state: PersonalAssetsPublic) => string;
    getNormalized: (state: PersonalAssetsPublic) => NormalForm;
    getWMLQuery: (state: PersonalAssetsPublic) => WMLQuery | undefined;
}

export const publicSelectors: PublicSelectors = {
    getCurrentWML: (state) => (state.wmlQuery?.source || ''),
    getWMLQuery: (state) => (state.wmlQuery),
    getNormalized: (state) => (state.wmlQuery?.normalize() || {})
}