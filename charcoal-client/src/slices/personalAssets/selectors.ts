import { SchemaTag } from '@tonylb/mtw-wml/dist/schema/baseClasses';
import { PersonalAssetsLoadedImage, PersonalAssetsPublic } from './baseClasses'
import { NormalForm } from '@tonylb/mtw-wml/dist/normalize/baseClasses'
import { GenericTree, TreeId } from '@tonylb/mtw-wml/dist/tree/baseClasses';
import { StandardForm } from '@tonylb/mtw-wml/dist/standardize/baseClasses';
import { createSelector } from '@reduxjs/toolkit';
import { Standardizer } from '@tonylb/mtw-wml/dist/standardize';

export type PublicSelectors = {
    getCurrentWML: (state: PersonalAssetsPublic) => string;
    getDraftWML: (state: PersonalAssetsPublic) => string;
    getSchema: (state: PersonalAssetsPublic & { key: string }) => GenericTree<SchemaTag, TreeId>;
    getBaseSchema: (state: PersonalAssetsPublic & { key: string }) => GenericTree<SchemaTag, TreeId>;
    getStandardForm: (state: PersonalAssetsPublic & { key: string }) => StandardForm;
    getInherited: (state: PersonalAssetsPublic & { key: string }) => StandardForm;
    getImportData: (state: PersonalAssetsPublic & { key: string }) => Record<string, GenericTree<SchemaTag, TreeId>>;
    getInheritedByAssetId: (state: PersonalAssetsPublic & { key: string }) => { assetId: string, standardForm: StandardForm }[];
    getLoadedImages: (state: PersonalAssetsPublic) => Record<string, PersonalAssetsLoadedImage>;
    getProperties: (state: PersonalAssetsPublic) => Record<string, { fileName: string }>;
    getSerialized: (state: PersonalAssetsPublic) => boolean | undefined;
}

const getCurrentWML = (state: PersonalAssetsPublic) => (state.currentWML || '')

const getDraftWML = (state: PersonalAssetsPublic) => (state.draftWML || '')

const getSchema = ({ schema }: PersonalAssetsPublic) => (schema)

const getBaseSchema = ({ baseSchema }: PersonalAssetsPublic) => (baseSchema)

const getStandardForm = ({ standard }: PersonalAssetsPublic) => (standard)

const getInherited = ({ inherited }: PersonalAssetsPublic) => (inherited)

const getImportData = ({ importData }: PersonalAssetsPublic) => (importData)

const getInheritedByAssetId = createSelector(getImportData, (importData) => {
    const standardFormsById = Object.entries(importData)
        .map(([assetId, schema]) => {
            const standardizer = new Standardizer(schema)
            return { assetId, standardForm: standardizer.standardForm }  
        })
    return standardFormsById
})

const getProperties = (state: PersonalAssetsPublic) => (state.properties)

const getLoadedImages = (state: PersonalAssetsPublic) => ( state.loadedImages )

const getSerialized = ({ serialized }: PersonalAssetsPublic): boolean | undefined => {
    return serialized
}

export const publicSelectors: PublicSelectors = {
    getCurrentWML,
    getDraftWML,
    getSchema,
    getBaseSchema,
    getStandardForm,
    getInherited,
    getImportData,
    getInheritedByAssetId,
    getProperties,
    getLoadedImages,
    getSerialized
}
