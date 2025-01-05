import { PersonalAssetsLoadedImage, PersonalAssetsPublic } from './baseClasses'
import { GenericTree } from '@tonylb/mtw-base/ts/genericTree';
import { createSelector } from '@reduxjs/toolkit';
import { StandardForm } from '@tonylb/mtw-wml/ts/standardize';
import { StandardFormData } from '@tonylb/mtw-wml/ts/standardize/components/dataTypes';
import { SchemaTag } from '@tonylb/mtw-base/ts/schema';

export type PublicSelectors = {
    getCurrentWML: (state: PersonalAssetsPublic) => string;
    getDraftWML: (state: PersonalAssetsPublic) => string;
    getStandardForm: (state: PersonalAssetsPublic & { key: string }) => StandardFormData;
    getInherited: (state: PersonalAssetsPublic & { key: string }) => StandardFormData;
    getImportData: (state: PersonalAssetsPublic & { key: string }) => Record<string, GenericTree<SchemaTag>>;
    getInheritedByAssetId: (state: PersonalAssetsPublic & { key: string }) => { assetId: string, standardForm: StandardFormData }[];
    getLoadedImages: (state: PersonalAssetsPublic) => Record<string, PersonalAssetsLoadedImage>;
    getProperties: (state: PersonalAssetsPublic) => Record<string, { fileName: string }>;
    getSerialized: (state: PersonalAssetsPublic) => boolean | undefined;
    getEdit: (state: PersonalAssetsPublic) => PersonalAssetsPublic["edit"];
    getPendingEdits: (state: PersonalAssetsPublic) => PersonalAssetsPublic["pendingEdits"];
}

const getCurrentWML = (state: PersonalAssetsPublic) => (state.currentWML || '')

const getDraftWML = (state: PersonalAssetsPublic) => (state.draftWML || '')

const getBase = ({ base }: PersonalAssetsPublic) => (base)
export const getEdit = ({ edit }: PersonalAssetsPublic) => (edit)
const getPendingEdits = ({ pendingEdits }: PersonalAssetsPublic) => (pendingEdits)

const getInherited = ({ inherited }: PersonalAssetsPublic) => (inherited)

const getStandardForm = createSelector(
    getInherited,
    getBase,
    getPendingEdits,
    getEdit,
    (inherited, base, pendingEdits, edit) => {
        const inheritedStandardized = new StandardForm(inherited)
        const combined = [base, ...pendingEdits.map(({ edit }) => (edit)), edit].reduce<StandardForm>((previous, standardForm) => {
            try {
                const standardized = new StandardForm(standardForm)
                return previous.merge(standardized)
            }
            catch {
                return previous
            }
        }, inheritedStandardized)
        return combined.toJSON()
    }
)

const getImportData = ({ importData }: PersonalAssetsPublic) => (importData)

const getInheritedByAssetId = createSelector(getImportData, (importData) => {
    const standardFormsById = Object.entries(importData)
        .map(([assetId, schema]) => {
            const standardized = new StandardForm(schema[0])
            return { assetId, standardForm: standardized.toJSON() }  
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
    getStandardForm,
    getInherited,
    getImportData,
    getInheritedByAssetId,
    getProperties,
    getLoadedImages,
    getSerialized,
    getPendingEdits,
    getEdit
}
