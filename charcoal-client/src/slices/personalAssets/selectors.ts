import { createSelector } from '@reduxjs/toolkit';

import { PersonalAssetsNodes, PersonalAssetsPublic, InheritedExit } from './baseClasses'
import { WMLQuery, WMLQueryUpdate } from '../../wml/wmlQuery'
import { NormalForm, ComponentAppearance } from '../../wml/normalize'

export type PublicSelectors = {
    getCurrentWML: (state: PersonalAssetsPublic) => string;
    getNormalized: (state: PersonalAssetsPublic) => NormalForm;
    getWMLQuery: (state: PersonalAssetsPublic) => WMLQuery;
    getDefaultAppearances: (state: PersonalAssetsPublic) => Record<string, ComponentAppearance>
    getInheritedExits: (state: PersonalAssetsPublic) => InheritedExit[]
}

const getCurrentWML = (state: PersonalAssetsPublic) => (state.currentWML || '')

const getWMLQuery = createSelector(getCurrentWML, (currentWML) => (new WMLQuery(currentWML)))

const getNormalized = createSelector(getWMLQuery, (wmlQuery) => (wmlQuery.normalize() || {}))

const getDefaultAppearances = (state: PersonalAssetsPublic) => (state.defaultAppearances || {})

const getInheritedExits = (state: PersonalAssetsPublic) => (state.inheritedExits || [])

export const publicSelectors: PublicSelectors = {
    getCurrentWML,
    getWMLQuery,
    getNormalized,
    getDefaultAppearances,
    getInheritedExits
}