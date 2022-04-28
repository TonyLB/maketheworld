import { createSelector } from '@reduxjs/toolkit';

import { PersonalAssetsNodes, PersonalAssetsPublic,  } from './baseClasses'
import { WMLQuery, WMLQueryUpdate } from '../../wml/wmlQuery'
import { NormalForm, ComponentAppearance } from '../../wml/normalize'

export type PublicSelectors = {
    getCurrentWML: (state: PersonalAssetsPublic) => string;
    getNormalized: (state: PersonalAssetsPublic) => NormalForm;
    getWMLQuery: (state: PersonalAssetsPublic) => WMLQuery;
    getDefaultAppearances: (state: PersonalAssetsPublic) => Record<string, ComponentAppearance>
}

const getCurrentWML = (state: PersonalAssetsPublic) => (state.currentWML || '')

const getWMLQuery = createSelector(getCurrentWML, (currentWML) => (new WMLQuery(currentWML)))

const getNormalized = createSelector(getWMLQuery, (wmlQuery) => (wmlQuery.normalize() || {}))

const getDefaultAppearances = (state: PersonalAssetsPublic) => (state.defaultAppearances || {})

export const publicSelectors: PublicSelectors = {
    getCurrentWML,
    getWMLQuery,
    getNormalized,
    getDefaultAppearances
}