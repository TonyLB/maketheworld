import { SchemaTag } from '@tonylb/mtw-wml/dist/schema/baseClasses';
import { PersonalAssetsLoadedImage, PersonalAssetsPublic } from './baseClasses'
import { NormalForm } from '@tonylb/mtw-wml/dist/normalize/baseClasses'
import { GenericTree, TreeId } from '@tonylb/mtw-wml/dist/tree/baseClasses';
import { StandardForm } from '@tonylb/mtw-wml/dist/standardize/baseClasses';

export type PublicSelectors = {
    getCurrentWML: (state: PersonalAssetsPublic) => string;
    getDraftWML: (state: PersonalAssetsPublic) => string;
    getNormalized: (state: PersonalAssetsPublic & { key: string }) => NormalForm;
    getSchema: (state: PersonalAssetsPublic & { key: string }) => GenericTree<SchemaTag, TreeId>;
    getStandardForm: (state: PersonalAssetsPublic & { key: string }) => StandardForm;
    getLoadedImages: (state: PersonalAssetsPublic) => Record<string, PersonalAssetsLoadedImage>;
    getProperties: (state: PersonalAssetsPublic) => Record<string, { fileName: string }>;
    getSerialized: (state: PersonalAssetsPublic) => boolean | undefined;
}

const getCurrentWML = (state: PersonalAssetsPublic) => (state.currentWML || '')

const getDraftWML = (state: PersonalAssetsPublic) => (state.draftWML || '')

const getSchema = ({ schema }: PersonalAssetsPublic) => (schema)

const getStandardForm = ({ standard }: PersonalAssetsPublic) => (standard)

//
// TODO: Refactor getNormalized to derive from schema rather than storing normal
// separately
//
const getNormalized = ({ normal }: PersonalAssetsPublic) => (normal)

const getProperties = (state: PersonalAssetsPublic) => (state.properties)

const getLoadedImages = (state: PersonalAssetsPublic) => ( state.loadedImages )

const getSerialized = ({ serialized }: PersonalAssetsPublic): boolean | undefined => {
    return serialized
}

export const publicSelectors: PublicSelectors = {
    getCurrentWML,
    getDraftWML,
    getNormalized,
    getSchema,
    getStandardForm,
    getProperties,
    getLoadedImages,
    getSerialized
}
