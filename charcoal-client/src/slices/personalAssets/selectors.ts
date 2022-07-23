import { createSelector } from '@reduxjs/toolkit';

import { PersonalAssetsNodes, PersonalAssetsPublic } from './baseClasses'
import { InheritedExit, InheritedComponent } from './inheritedData'
import { WMLQuery } from '@tonylb/mtw-wml/dist/wmlQuery'
import { NormalForm, ComponentAppearance } from '@tonylb/mtw-wml/dist/normalize'
import { wmlQueryFromCache } from '../../lib/wmlQueryCache';

export type PublicSelectors = {
    getCurrentWML: (state: PersonalAssetsPublic) => string;
    getNormalized: (state: PersonalAssetsPublic & { key: string }) => NormalForm;
    getWMLQuery: (state: PersonalAssetsPublic & { key: string }) => WMLQuery;
    getDefaultAppearances: (state: PersonalAssetsPublic) => Record<string, InheritedComponent>
    getInheritedExits: (state: PersonalAssetsPublic) => InheritedExit[]
}

const getCurrentWML = (state: PersonalAssetsPublic) => (state.currentWML || '')

const getWMLKey = ({ key }: PersonalAssetsPublic & { key: string }) => (key)

const getWMLQuery = createSelector(getWMLKey, (key) => {
    return wmlQueryFromCache({ key })
})

const getWMLSource = (state: PersonalAssetsPublic & { key: string }) => (getWMLQuery(state).source)

const getNormalized = createSelector(getWMLQuery, getWMLSource, (wmlQuery) => (wmlQuery.normalize() || {}))

const getDefaultAppearances = (state: PersonalAssetsPublic) => (state.defaultAppearances || {})

const getInheritedExits = (state: PersonalAssetsPublic) => (state.inheritedExits || [])

export const publicSelectors: PublicSelectors = {
    getCurrentWML,
    getWMLQuery,
    getNormalized,
    getDefaultAppearances,
    getInheritedExits
}