import { PersonalAssetsLoadedImage, PersonalAssetsPublic } from './baseClasses'
import { NormalForm } from '@tonylb/mtw-wml/dist/normalize/baseClasses'
import { AssetClientImportDefaults } from '@tonylb/mtw-interfaces/dist/asset';
import { EphemeraAssetId } from '@tonylb/mtw-interfaces/dist/baseClasses';

export type PublicSelectors = {
    getCurrentWML: (state: PersonalAssetsPublic) => string;
    getDraftWML: (state: PersonalAssetsPublic) => string;
    getNormalized: (state: PersonalAssetsPublic & { key: string }) => NormalForm;
    getLoadedImages: (state: PersonalAssetsPublic) => Record<string, PersonalAssetsLoadedImage>;
    getProperties: (state: PersonalAssetsPublic) => Record<string, { fileName: string }>;
    getImportDefaults: (state: PersonalAssetsPublic) => AssetClientImportDefaults["defaultsByKey"];
    getImportData: (state: PersonalAssetsPublic) => (assetKey: string) => NormalForm | undefined;
}

const getCurrentWML = (state: PersonalAssetsPublic) => (state.currentWML || '')

const getDraftWML = (state: PersonalAssetsPublic) => (state.draftWML || '')

const getNormalized = ({ normal }: PersonalAssetsPublic) => (normal)

const getImportDefaults = (state: PersonalAssetsPublic) => (state.importDefaults)

const getProperties = (state: PersonalAssetsPublic) => (state.properties)

const getLoadedImages = (state: PersonalAssetsPublic) => ( state.loadedImages )

const getImportData = ({ importData = {} }: PersonalAssetsPublic) => (assetKey: string): NormalForm | undefined => {
    return importData[assetKey]
}

export const publicSelectors: PublicSelectors = {
    getCurrentWML,
    getDraftWML,
    getNormalized,
    getImportDefaults,
    getProperties,
    getLoadedImages,
    getImportData
}
