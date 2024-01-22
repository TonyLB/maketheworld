import { SchemaTag } from '@tonylb/mtw-wml/dist/simpleSchema/baseClasses';
import { PersonalAssetsLoadedImage, PersonalAssetsPublic } from './baseClasses'
import { NormalForm } from '@tonylb/mtw-wml/dist/normalize/baseClasses'
import { GenericTree, TreeId } from '@tonylb/mtw-wml/dist/sequence/tree/baseClasses';

export type PublicSelectors = {
    getCurrentWML: (state: PersonalAssetsPublic) => string;
    getDraftWML: (state: PersonalAssetsPublic) => string;
    getNormalized: (state: PersonalAssetsPublic & { key: string }) => NormalForm;
    getSchema: (state: PersonalAssetsPublic & { key: string }) => GenericTree<SchemaTag, TreeId>;
    getLoadedImages: (state: PersonalAssetsPublic) => Record<string, PersonalAssetsLoadedImage>;
    getProperties: (state: PersonalAssetsPublic) => Record<string, { fileName: string }>;
    getImportData: (state: PersonalAssetsPublic) => (assetKey: string) => NormalForm | undefined;
    getSerialized: (state: PersonalAssetsPublic) => boolean | undefined;
}

const getCurrentWML = (state: PersonalAssetsPublic) => (state.currentWML || '')

const getDraftWML = (state: PersonalAssetsPublic) => (state.draftWML || '')

const getNormalized = ({ normal }: PersonalAssetsPublic) => (normal)

const getSchema = ({ schema }: PersonalAssetsPublic) => (schema)

const getProperties = (state: PersonalAssetsPublic) => (state.properties)

const getLoadedImages = (state: PersonalAssetsPublic) => ( state.loadedImages )

const getImportData = ({ importData = {} }: PersonalAssetsPublic) => (assetKey: string): NormalForm | undefined => {
    return importData[assetKey]
}

const getSerialized = ({ serialized }: PersonalAssetsPublic): boolean | undefined => {
    return serialized
}

export const publicSelectors: PublicSelectors = {
    getCurrentWML,
    getDraftWML,
    getNormalized,
    getSchema,
    getProperties,
    getLoadedImages,
    getImportData,
    getSerialized
}
