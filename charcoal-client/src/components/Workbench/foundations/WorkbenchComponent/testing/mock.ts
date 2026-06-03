import { vi } from 'vitest'
import { StandardForm } from '@tonylb/mtw-wml/ts/standardize'
import type { AssetUUID, ComponentUUID } from '@tonylb/mtw-base/ts/schema'
import StandardFeature from '@tonylb/mtw-wml/ts/standardize/components/feature'
import StandardReference from '@tonylb/mtw-wml/ts/standardize/components/reference'
import { componentTagFromUniversalKey } from '@tonylb/mtw-wml/ts/standardize/components/dataTypes/abstract'

import { materializeComponent, type MaterializeSpec } from '../../consistency/materializeComponent'
import type { useWorkbenchAsset } from '../../useWorkbenchAsset'

export const updateStandardMock = vi.fn()
export const materializeComponentInAssetMock = vi.fn<
    (spec: MaterializeSpec) => Promise<StandardReference>
>(async () => {
    throw new Error('materializeComponentInAsset not mocked')
})

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
    materializeComponentInAsset: materializeComponentInAssetMock,
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
    materializeComponentInAssetMock.mockClear()
    mockWorkbenchReturn = {
        assetKey: 'test',
        AssetId: 'ASSET#test',
        standardForm: defaultStandardForm,
        localStandardForm: defaultStandardForm,
        inheritedStandardForm: defaultStandardForm,
        inheritedByAssetId: [],
        updateStandard: updateStandardMock,
        materializeComponentInAsset: materializeComponentInAssetMock,
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

/** Default mock: materialize via pure materializeComponent on the mocked local draft. */
export const mockMaterializeComponentInAsset = (): void => {
    materializeComponentInAssetMock.mockImplementation(async (spec: MaterializeSpec) => {
        const draft = mockWorkbenchReturn.localStandardForm._clone()
        const ref = materializeComponent(draft, spec)
        mockWorkbenchReturn.localStandardForm = draft
        mockWorkbenchReturn.standardForm = draft
        return ref
    })
}

/** Import mock: return ref without requiring importData on the asset fixture. */
export const mockMaterializeComponentInAssetImport = (): void => {
    materializeComponentInAssetMock.mockImplementation(
        async (spec: MaterializeSpec & { fromAsset?: AssetUUID }) => {
            const tag = componentTagFromUniversalKey(spec.universalKey)
            return new StandardReference({ universalKey: spec.universalKey, tag })
        }
    )
}

/** Run the most recent updateStandard mock update fn against a draft clone. */
export const applyLastUpdateStandardMock = (draft?: StandardForm): StandardForm => {
    const lastCall = updateStandardMock.mock.calls[updateStandardMock.mock.calls.length - 1][0]
    const base =
        draft ??
        (lastCall.type === 'updateLocal'
            ? mockWorkbenchReturn.localStandardForm._clone()
            : mockWorkbenchReturn.standardForm._clone())
    return lastCall.update(base)
}

/** Apply the most recent flush to the mocked committed standardForm (simulate Redux echo). */
export const applyLastFlushToCommitted = (): StandardForm => {
    const updated = applyLastUpdateStandardMock()
    mockWorkbenchReturn.standardForm = updated
    mockWorkbenchReturn.localStandardForm = updated
    return updated
}

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
