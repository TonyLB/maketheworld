import { SchemaTag } from '@tonylb/mtw-wml/dist/schema/baseClasses';
import { PersonalAssetsLoadedImage, PersonalAssetsPublic } from './baseClasses'
import { GenericTree } from '@tonylb/mtw-wml/dist/tree/baseClasses';
import { StandardForm } from '@tonylb/mtw-wml/dist/standardize/baseClasses';
import { createSelector } from '@reduxjs/toolkit';
import { Standardizer } from '@tonylb/mtw-wml/dist/standardize';

export type PublicSelectors = {
    getCurrentWML: (state: PersonalAssetsPublic) => string;
    getDraftWML: (state: PersonalAssetsPublic) => string;
    getStandardForm: (state: PersonalAssetsPublic & { key: string }) => StandardForm;
    getInherited: (state: PersonalAssetsPublic & { key: string }) => StandardForm;
    getImportData: (state: PersonalAssetsPublic & { key: string }) => Record<string, GenericTree<SchemaTag>>;
    getInheritedByAssetId: (state: PersonalAssetsPublic & { key: string }) => { assetId: string, standardForm: StandardForm }[];
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
        const inheritedStandardizer = new Standardizer()
        inheritedStandardizer.loadStandardForm(inherited)
        const combined = [base, ...pendingEdits.map(({ edit }) => (edit)), edit].reduce<Standardizer>((previous, standardForm) => {
            try {
                const standardizer = new Standardizer()
                standardizer.loadStandardForm(standardForm)
                return previous.merge(standardizer) as Standardizer
            }
            catch {
                return previous
            }
        }, inheritedStandardizer)
        return combined.standardForm
    }
)

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
