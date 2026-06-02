import { vi } from 'vitest'
import { StandardForm } from '@tonylb/mtw-wml/ts/standardize'
import type { ComponentUUID } from '@tonylb/mtw-base/ts/schema'
import StandardFeature from '@tonylb/mtw-wml/ts/standardize/components/feature'

import type { useWorkbenchAsset } from '../../useWorkbenchAsset'

export const updateStandardMock = vi.fn()

const defaultStandardForm = new StandardForm({
    universalKey: 'ASSET#test',
    components: [],
    metaData: []
})

export let mockWorkbenchReturn: ReturnType<typeof useWorkbenchAsset> = {
    assetKey: 'test',
    AssetId: 'ASSET#test',
    standardForm: defaultStandardForm,
    localStandardForm: defaultStandardForm,
    inheritedStandardForm: defaultStandardForm,
    inheritedByAssetId: [],
    updateStandard: updateStandardMock,
    loadedImages: {},
    properties: {},
    readonly: false,
    saving: false,
    pendingEdits: []
}

const toStandardForm = (wml: string | StandardForm): StandardForm =>
    wml instanceof StandardForm ? wml : new StandardForm(wml)

export const resetWorkbenchAssetMock = (): void => {
    updateStandardMock.mockClear()
    mockWorkbenchReturn = {
        assetKey: 'test',
        AssetId: 'ASSET#test',
        standardForm: defaultStandardForm,
        localStandardForm: defaultStandardForm,
        inheritedStandardForm: defaultStandardForm,
        inheritedByAssetId: [],
        updateStandard: updateStandardMock,
        loadedImages: {},
        properties: {},
        readonly: false,
        saving: false,
        pendingEdits: []
    }
}

export const seedWorkbenchAsset = (
    wml: string | StandardForm,
    readonly = false
): StandardForm => {
    const standardForm = toStandardForm(wml)
    mockWorkbenchReturn.standardForm = standardForm
    mockWorkbenchReturn.localStandardForm = standardForm
    mockWorkbenchReturn.readonly = readonly
    return standardForm
}

/** Run the most recent updateStandard mock update fn against a draft clone. */
export const applyLastUpdateStandardMock = (draft: StandardForm): StandardForm =>
    updateStandardMock.mock.calls[updateStandardMock.mock.calls.length - 1][0].update(draft)

/** Read shortName from the component assigned by the most recent flush mock call. */
export const getFlushedFeatureShortName = (
    componentId: ComponentUUID,
    baseForm: StandardForm
): string | undefined => {
    const updated = applyLastUpdateStandardMock(baseForm._clone())
    const component = updated.byUniversalId[componentId]
    if (!(component instanceof StandardFeature)) {
        return undefined
    }
    const shortNameJson = component.shortName?.toJSON()
    return typeof shortNameJson === 'string' ? shortNameJson : undefined
}
