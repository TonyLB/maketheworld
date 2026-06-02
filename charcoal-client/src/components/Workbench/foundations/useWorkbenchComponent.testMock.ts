import { vi } from 'vitest'
import { StandardForm } from '@tonylb/mtw-wml/ts/standardize'

import type { useWorkbenchAsset } from './useWorkbenchAsset'

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
