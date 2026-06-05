import { PersonalAssetsLoadedImage, PersonalAssetsPublic } from './baseClasses'
import type { ScopedInstrumentationOptions } from '../../testing/scopedInstrumentation'
import { GenericTree } from '@tonylb/mtw-base/ts/genericTree';
import { createSelector } from '@reduxjs/toolkit';
import { StandardForm } from '@tonylb/mtw-wml/ts/standardize';
import { StandardFormData } from '@tonylb/mtw-wml/ts/standardize/components/dataTypes';
import { SchemaTag } from '@tonylb/mtw-base/ts/schema';
import { PENDING_TTL_MS, STABLE_EMPTY_CONFIRMED_IDS } from '../dataSource'

/** Augmented public data includes cross-slice fields injected by augmentPublicDataForSelect. */
export type PersonalAssetsPublicAugmented = PersonalAssetsPublic & {
    base: StandardFormData
    confirmedRequestIds?: string[]
}

export function selectEffectivePendingEdits(
    pendingEdits: PersonalAssetsPublic['pendingEdits'],
    confirmedIds: string[],
    now: number
): PersonalAssetsPublic['pendingEdits'] {
    const confirmedSet = new Set(confirmedIds)
    return pendingEdits.filter(
        ({ meta }) =>
            !confirmedSet.has(meta.key) &&
            now - meta.time < PENDING_TTL_MS
    )
}

const EMPTY_BASE: StandardFormData = { universalKey: 'ASSET#uninitialized', components: [], metaData: [] }

export type PublicSelectors = {
    getBase: (state: PersonalAssetsPublic & { key: string }) => StandardFormData;
    getLocalStandardForm: (state: PersonalAssetsPublic & { key: string }) => StandardFormData;
    getStandardForm: (state: PersonalAssetsPublic & { key: string }) => StandardFormData;
    getInherited: (state: PersonalAssetsPublic & { key: string }) => StandardFormData;
    getImportData: (state: PersonalAssetsPublic & { key: string }) => Record<string, GenericTree<SchemaTag>>;
    getInheritedByAssetId: (state: PersonalAssetsPublic & { key: string }) => { assetId: string, standardForm: StandardFormData }[];
    getLoadedImages: (state: PersonalAssetsPublic) => Record<string, PersonalAssetsLoadedImage>;
    getProperties: (state: PersonalAssetsPublic) => Record<string, { fileName: string }> | undefined;
    getSerialized: (state: PersonalAssetsPublic) => boolean | undefined;
    getEdit: (state: PersonalAssetsPublic) => PersonalAssetsPublic["edit"];
    getPendingEdits: (state: PersonalAssetsPublic) => PersonalAssetsPublic["pendingEdits"];
    getEffectivePendingEdits: (state: PersonalAssetsPublic & { key: string }) => PersonalAssetsPublic["pendingEdits"];
    getInstrumentationOptionsForCurrentEdit: (state: PersonalAssetsPublic) => ScopedInstrumentationOptions | undefined;
}

const getBase = (state: PersonalAssetsPublic & { key: string }): StandardFormData =>
    (state as unknown as PersonalAssetsPublicAugmented).base ?? EMPTY_BASE
export const getEdit = ({ edit }: PersonalAssetsPublic) => (edit)
const getPendingEdits = ({ pendingEdits }: PersonalAssetsPublic) => (pendingEdits)
const getInstrumentationOptionsForCurrentEdit = ({ instrumentationOptionsForCurrentEdit }: PersonalAssetsPublic): ScopedInstrumentationOptions | undefined => instrumentationOptionsForCurrentEdit

const getInherited = ({ inherited }: PersonalAssetsPublic) => (inherited)

const getConfirmedRequestIds = (state: PersonalAssetsPublic & { key: string }): string[] =>
    (state as unknown as PersonalAssetsPublicAugmented).confirmedRequestIds ?? STABLE_EMPTY_CONFIRMED_IDS

/** Effective overlay for merge views; raw getPendingEdits remains for storage / saving indicator. */
const getEffectivePendingEdits = createSelector(
    getPendingEdits,
    getConfirmedRequestIds,
    (pendingEdits, confirmedIds) => selectEffectivePendingEdits(pendingEdits, confirmedIds, Date.now())
)

const getLocalStandardForm = createSelector(
    getBase,
    getEffectivePendingEdits,
    getEdit,
    (base, effectivePendingEdits, edit) => {
        const baseStandardized = new StandardForm(base)
        const combined = [...effectivePendingEdits.map(({ edit }) => (edit)), edit].reduce<StandardForm>((previous, standardForm) => {
            try {
                const standardized = new StandardForm(standardForm)
                return previous.merge(standardized)
            }
            catch {
                return previous
            }
        }, baseStandardized)
        return combined.toJSON()
    }
)

const getStandardForm = createSelector(
    getInherited,
    getLocalStandardForm,
    (inherited, local) => {
        const inheritedStandardized = new StandardForm(inherited)
        const localStandardized = new StandardForm(local)
        try {
            return inheritedStandardized.merge(localStandardized).toJSON()
        }
        catch {
            return inheritedStandardized.toJSON()
        }
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
    getBase,
    getLocalStandardForm,
    getStandardForm,
    getInherited,
    getImportData,
    getInheritedByAssetId,
    getProperties,
    getLoadedImages,
    getSerialized,
    getPendingEdits,
    getEffectivePendingEdits,
    getEdit,
    getInstrumentationOptionsForCurrentEdit
}
