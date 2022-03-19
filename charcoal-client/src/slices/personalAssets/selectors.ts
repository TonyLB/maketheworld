import { createSelector } from '@reduxjs/toolkit';

import { PersonalAssetsNodes, PersonalAssetsPublic,  } from './baseClasses'
import { WMLQuery, WMLQueryUpdate } from '../../wml/wmlQuery'
import { NormalForm } from '../../wml/normalize'

export type PublicSelectors = {
    getCurrentWML: (state: PersonalAssetsPublic) => string;
    getNormalized: (state: PersonalAssetsPublic) => NormalForm;
    getWMLQuery: (state: PersonalAssetsPublic) => WMLQuery;
}

const getCurrentWML = (state: PersonalAssetsPublic) => (state.currentWML || '')

const getWMLQuery = createSelector(getCurrentWML, (currentWML) => (new WMLQuery(currentWML)))

const getNormalized = createSelector(getWMLQuery, (wmlQuery) => (wmlQuery.normalize() || {}))

export const publicSelectors: PublicSelectors = {
    getCurrentWML,
    getWMLQuery,
    getNormalized
}