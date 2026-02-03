import { createSlice, PayloadAction, createSelector } from '@reduxjs/toolkit'

import { RootState, Selector, AppDispatch } from '../../../store'
import { AssetUUID, ComponentUUID } from '@tonylb/mtw-base/ts/schema'
import { StandardForm } from '@tonylb/mtw-wml/ts/standardize'
import { getLayeredContext } from '../../../components/Workbench/foundations/LayeredContext/layeredContextUtils'
import cacheDB, { ClientSettingType } from '../../../cacheDB'
import { getStandardForm } from '../../personalAssets'
import { getAssetZone, getMyAssets } from '../../player'
import { AssetKey } from '@tonylb/mtw-utilities/ts/types'

type WorkbenchBreadcrumbKind = 'component'

type WorkbenchView = 'asset' | 'component' | 'componentLayer' | null

export type WorkbenchBreadcrumbEntry = {
    //
    // NOTE: Breadcrumbs track **navigation history**, not schema ancestry.
    //
    // Invariants:
    // - breadcrumbStack tracks **within-asset** navigation only (component ids).
    // - All entries use kind: 'component' and componentId. "Layered" context (e.g. Examples,
    //   Guidance tabs) is derived when the top of the stack is a ref-list child of the
    //   second-to-top (see getLayeredContext in layeredContextUtils).
    //
    // Asset identity is modeled separately via currentAssetId. When deriving a full
    // navigation trail for the UI, selectors treat the currentAssetId as an implicit
    // leading asset breadcrumb, followed by this within-asset stack.
    //
    id: string;
    kind: WorkbenchBreadcrumbKind;
    componentId: string | null;
}

interface WorkbenchState {
    open: boolean;
    authoringMode: 'play' | 'authoring';
    currentAssetId: AssetUUID | null;
    secondaryContext: string | null;
    breadcrumbStack: WorkbenchBreadcrumbEntry[];
}

const initialState: WorkbenchState = {
    open: false,
    authoringMode: 'play',
    currentAssetId: null,
    secondaryContext: null,
    breadcrumbStack: []
}

const workbenchSlice = createSlice({
    name: 'workbench',
    initialState,
    reducers: {
        openWorkbench(state) {
            state.open = true
        },
        closeWorkbench(state) {
            state.open = false
        },
        setCurrentAssetId(state, action: PayloadAction<AssetUUID | null>) {
            const nextAssetId = action.payload
            const prevAssetId = state.currentAssetId
            state.currentAssetId = nextAssetId
            //
            // When clearing the asset entirely (back to selector), or when
            // switching to a different asset, any existing within-asset
            // breadcrumb history becomes invalid and should be cleared.
            //
            if (!nextAssetId || nextAssetId !== prevAssetId) {
                state.breadcrumbStack = []
            }
        },
        setAuthoringMode(state, action: PayloadAction<'play' | 'authoring'>) {
            state.authoringMode = action.payload
        },
        setSecondaryContext(state, action: PayloadAction<string | null>) {
            state.secondaryContext = action.payload
        },
        receiveWorkbenchSettings(state, action: PayloadAction<Partial<Pick<WorkbenchState, 'currentAssetId'>>>) {
            const nextAssetId = action.payload.currentAssetId
            if (nextAssetId !== undefined) {
                state.currentAssetId = nextAssetId
                //
                // If settings explicitly clear currentAssetId, also clear breadcrumb history so the
                // header falls back to the asset selector state.
                //
                if (!nextAssetId) {
                    state.breadcrumbStack = []
                }
            }
        },
        //
        // Breadcrumb actions
        //
        pushBreadcrumb(state, action: PayloadAction<WorkbenchBreadcrumbEntry>) {
            const next = action.payload
            const last = state.breadcrumbStack[state.breadcrumbStack.length - 1]
            //
            // Avoid trivial duplicates when repeatedly navigating to the same
            // component. More complex sibling navigation (\"jump from this
            // room directly to a feature\") can build on top of this by
            // dispatching an explicit pop followed by a push.
            //
            if (last && last.kind === next.kind && last.id === next.id) {
                return
            }
            state.breadcrumbStack = [...state.breadcrumbStack, next]
        },
        popBreadcrumbToIndex(state, action: PayloadAction<number>) {
            const index = action.payload
            if (index < 0 || index >= state.breadcrumbStack.length) {
                return
            }
            state.breadcrumbStack = state.breadcrumbStack.slice(0, index + 1)
        },
        resetBreadcrumbs(state) {
            state.breadcrumbStack = []
        },
        setBreadcrumbStack(state, action: PayloadAction<WorkbenchBreadcrumbEntry[]>) {
            state.breadcrumbStack = action.payload
        }
    }
})

export const {
    openWorkbench,
    closeWorkbench,
    setCurrentAssetId,
    setAuthoringMode,
    setSecondaryContext,
    receiveWorkbenchSettings,
    pushBreadcrumb,
    popBreadcrumbToIndex,
    resetBreadcrumbs,
    setBreadcrumbStack
} = workbenchSlice.actions

//
// Navigation helpers
//

export const navigateToComponent = (componentId: ComponentUUID) => (dispatch: AppDispatch, getState: () => RootState) => {
    const state = getState()
    const assetId = state.UI.workbench.currentAssetId
    if (!assetId) {
        return
    }
    const stack: WorkbenchBreadcrumbEntry[] = [
        { id: componentId, kind: 'component', componentId }
    ]
    dispatch(setBreadcrumbStack(stack))
}

export const navigateViaBreadcrumbIndex = (index: number) => (dispatch: AppDispatch, getState: () => RootState) => {
    const state = getState()
    const stack = state.UI.workbench.breadcrumbStack
    //
    // Index is interpreted relative to the full navigation trail
    // (asset root at index 0, within-asset entries thereafter).
    // Index 0 means \"asset root\" → clear within-asset stack.
    //
    if (index <= 0) {
        dispatch(setBreadcrumbStack([]))
        return
    }
    const withinAssetIndex = index - 1
    if (withinAssetIndex < 0 || withinAssetIndex >= stack.length) {
        return
    }
    dispatch(setBreadcrumbStack(stack.slice(0, withinAssetIndex + 1)))
}

export const replaceTopBreadcrumb = (newComponentId: ComponentUUID) => (dispatch: AppDispatch, getState: () => RootState) => {
    const stack = getState().UI.workbench.breadcrumbStack
    if (stack.length < 1) return
    dispatch(setBreadcrumbStack([
        ...stack.slice(0, -1),
        { id: newComponentId, kind: 'component', componentId: newComponentId }
    ]))
}

// Selectors
export const getWorkbenchOpen: Selector<boolean> = (state: RootState) => state.UI.workbench.open
export const getAuthoringMode: Selector<'play' | 'authoring'> = (state: RootState) => state.UI.workbench.authoringMode
export const getCurrentAssetId: Selector<AssetUUID | null> = (state: RootState) => state.UI.workbench.currentAssetId
export const getSecondaryContext: Selector<string | null> = (state: RootState) => state.UI.workbench.secondaryContext
export const getBreadcrumbStack: Selector<WorkbenchBreadcrumbEntry[]> = (state: RootState) => state.UI.workbench.breadcrumbStack

// Intermediate selector to get standard form for current asset using full RootState
const getCurrentAssetStandardForm = createSelector(
    [getCurrentAssetId, (state: RootState) => state],
    (assetId, rootState) => {
        if (!assetId || !rootState.personalAssets?.byId) return null
        const standardFormSelector = getStandardForm(assetId)
        return standardFormSelector(rootState) || null
    }
)

// StandardForm instance for layered-context detection (getLayeredContext expects class instance)
const getCurrentAssetStandardFormInstance = createSelector(
    getCurrentAssetStandardForm,
    (data): StandardForm | null => (data ? new StandardForm(data) : null)
)

const getLayeredContextFromState = createSelector(
    [getCurrentAssetStandardFormInstance, getBreadcrumbStack],
    (standardForm, stack) => getLayeredContext(standardForm, stack)
)

//
// Navigation selectors
//

export const getNavigationTrail = createSelector(
    [getCurrentAssetId, getBreadcrumbStack],
    (assetId, stack): WorkbenchBreadcrumbEntry[] => {
        if (!assetId) {
            return []
        }
        const assetEntry: WorkbenchBreadcrumbEntry = {
            id: assetId,
            kind: 'component', // special-cased as asset in header; componentId remains null
            componentId: null
        }
        return [assetEntry, ...stack]
    }
)

export const getCurrentView: Selector<WorkbenchView> = createSelector(
    [getCurrentAssetId, getBreadcrumbStack, getLayeredContextFromState],
    (assetId, stack, layeredContext): WorkbenchView => {
        if (!assetId) return null
        if (!stack.length) return 'asset'
        if (layeredContext) return 'componentLayer'
        return 'component'
    }
)

export const getCurrentComponentId: Selector<string | null> = createSelector(
    [getBreadcrumbStack, getLayeredContextFromState],
    (stack, layeredContext): string | null => {
        if (layeredContext) return layeredContext.parentId
        const last = stack[stack.length - 1]
        return last?.componentId ?? null
    }
)

export const getCurrentComponentLayerId: Selector<string | null> = createSelector(
    [getBreadcrumbStack, getLayeredContextFromState],
    (stack, layeredContext): string | null => {
        if (layeredContext) return layeredContext.currentId
        return null
    }
)

// Fallback selector to get asset name from player slice
const getCurrentAssetFromPlayer = createSelector(
    [getCurrentAssetId, getMyAssets],
    (assetId, assets) => {
        if (!assetId) return null
        const normalizedId = AssetKey(assetId)
        return assets.find((asset: any) => AssetKey(asset.AssetId) === normalizedId) || null
    }
)

// Intermediate selector to get zone for current asset using full RootState
const getCurrentAssetZone = createSelector(
    [getCurrentAssetId, (state: RootState) => state],
    (assetId, rootState) => {
        if (!assetId) return null
        // getAssetZone(assetId) returns a selector that expects the full RootState
        const zoneSelector = getAssetZone(assetId)
        return zoneSelector(rootState) || 'Draft'
    }
)

// Memoized selector that combines data from personalAssets and player slices
export const getWorkbenchAssetInfo = createSelector(
    [getCurrentAssetId, getCurrentAssetStandardForm, getCurrentAssetZone, getCurrentAssetFromPlayer],
    (assetId, standardFormData, zone, playerAsset) => {
        if (!assetId) {
            return null
        }

        // Get asset name - try from personalAssets first, fallback to player slice
        let assetName = 'Untitled'
        
        // First, try to get from standardFormData (personalAssets)
        if (standardFormData?.shortName) {
            if (typeof standardFormData.shortName === 'string') {
                assetName = standardFormData.shortName
            } else if (typeof standardFormData.shortName === 'object' && standardFormData.shortName !== null) {
                // Handle Remove or Replace tags
                if (standardFormData.shortName.tag === 'Replace' && 'payload' in standardFormData.shortName) {
                    assetName = standardFormData.shortName.payload
                } else if (standardFormData.shortName.tag === 'Remove' && 'match' in standardFormData.shortName) {
                    // For Remove, we could use match or empty string - using match for now
                    assetName = standardFormData.shortName.match
                }
            }
        } 
        // Fallback to player slice if personalAssets not loaded yet
        else if (playerAsset && (playerAsset as any).ShortName) {
            assetName = (playerAsset as any).ShortName
        }

        // Format visibility state
        const visibilityState = zone === 'Draft' ? 'Private draft' : 
                                zone === 'Personal' ? 'Personal' : 
                                zone === 'Library' ? 'Library' : 
                                zone === 'Canon' ? 'Canon' : 
                                'Unknown'

        return {
            assetId,
            assetName,
            visibilityState
        }
    }
)

// Persistence functions (following currentCharacterId pattern)
export const loadWorkbenchSettings = (dispatch: AppDispatch) => {
    cacheDB.clientSettings.toArray()
        .then((settings) => {
            const currentAssetIdSetting = settings.find(({ key }) => key === 'CurrentAssetId')
            if (currentAssetIdSetting) {
                dispatch(receiveWorkbenchSettings({ 
                    currentAssetId: currentAssetIdSetting.value as AssetUUID | null 
                }))
            }
        })
}

export const putWorkbenchSettings = (settings: { currentAssetId?: AssetUUID | null }) => (dispatch: AppDispatch) => {
    const entries: ClientSettingType[] = []
    if (settings.currentAssetId !== undefined) {
        entries.push({ key: 'CurrentAssetId', value: settings.currentAssetId } as ClientSettingType)
    }
    
    if (entries.length > 0) {
        cacheDB.clientSettings.bulkPut(entries)
            .then(() => {
                dispatch(receiveWorkbenchSettings(settings))
            })
    }
}

export default workbenchSlice.reducer
