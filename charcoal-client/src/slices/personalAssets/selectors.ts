import { createSelector } from '@reduxjs/toolkit';

import { PersonalAssetsLoadedImage, PersonalAssetsPublic } from './baseClasses'
import { WMLQuery } from '@tonylb/mtw-wml/dist/wmlQuery'
import { NormalForm } from '@tonylb/mtw-wml/dist/normalize/baseClasses'
import { wmlQueryFromCache } from '../../lib/wmlQueryCache';
import { AssetClientImportDefaults } from '@tonylb/mtw-interfaces/dist/asset';

export type PublicSelectors = {
    getCurrentWML: (state: PersonalAssetsPublic) => string;
    getNormalized: (state: PersonalAssetsPublic & { key: string }) => NormalForm;
    getWMLQuery: (state: PersonalAssetsPublic & { key: string }) => WMLQuery;
    getLoadedImages: (state: PersonalAssetsPublic) => Record<string, PersonalAssetsLoadedImage>;
    getProperties: (state: PersonalAssetsPublic) => Record<string, { fileName: string }>;
    getImportDefaults: (state: PersonalAssetsPublic) => AssetClientImportDefaults["defaultsByKey"]
}

const getCurrentWML = (state: PersonalAssetsPublic) => (state.currentWML || '')

const getWMLKey = ({ key }: PersonalAssetsPublic & { key: string }) => (key)

const getWMLQuery = createSelector(getWMLKey, (key) => {
    return wmlQueryFromCache({ key })
})

const getWMLSource = (state: PersonalAssetsPublic & { key: string }) => (getWMLQuery(state).source)

const getNormalized = ({ normal }: PersonalAssetsPublic) => (normal)

const getImportDefaults = (state: PersonalAssetsPublic) => (state.importDefaults)

const getProperties = (state: PersonalAssetsPublic) => (state.properties)

const getLoadedImages = (state: PersonalAssetsPublic) => ( state.loadedImages )

export const publicSelectors: PublicSelectors = {
    getCurrentWML,
    getWMLQuery,
    getNormalized,
    getImportDefaults,
    getProperties,
    getLoadedImages
}
