import { createSelector } from '@reduxjs/toolkit';

import { PersonalAssetsNodes, PersonalAssetsPublic } from './baseClasses'
import { InheritedExit, InheritedComponent } from './inheritedData'
import { WMLQuery, WMLQueryUpdate } from '../../wml/wmlQuery'
import { NormalForm, ComponentAppearance } from '../../wml/normalize'
import { wmlQueryFromCache } from '../../lib/wmlQueryCache';

export type PublicSelectors = {
    getCurrentWML: (state: PersonalAssetsPublic) => string;
    getNormalized: (state: PersonalAssetsPublic & { key: string }) => NormalForm;
    getWMLQuery: (state: PersonalAssetsPublic & { key: string }) => WMLQuery;
    getDefaultAppearances: (state: PersonalAssetsPublic) => Record<string, InheritedComponent>
    getInheritedExits: (state: PersonalAssetsPublic) => InheritedExit[]
}

const getCurrentWML = (state: PersonalAssetsPublic) => (state.currentWML || '')

const getWMLQuery = ({ key }: PersonalAssetsPublic & { key: string }) => (wmlQueryFromCache({ key }))

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