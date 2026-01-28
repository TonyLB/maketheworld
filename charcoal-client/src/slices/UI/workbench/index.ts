import { createSlice, PayloadAction, createSelector } from '@reduxjs/toolkit'

import { RootState, Selector, AppDispatch } from '../../../store'
import { AssetUUID, ComponentUUID } from '@tonylb/mtw-base/ts/schema'
import cacheDB, { ClientSettingType } from '../../../cacheDB'
import { getStandardForm } from '../../personalAssets'
import { getAssetZone, getMyAssets } from '../../player'
import { AssetKey } from '@tonylb/mtw-utilities/ts/types'

type WorkbenchBreadcrumbKind = 'component' | 'componentLayer'

type WorkbenchView = 'asset' | 'component' | 'componentLayer' | null

export type WorkbenchBreadcrumbEntry = {
    //
    // NOTE: Breadcrumbs track **navigation history**, not schema ancestry.
    //
    // Invariants:
    // - breadcrumbStack tracks **within-asset** navigation only (components and layered views).
    // - Zero or more component entries may exist; the last { kind: 'component' } is the
    //   current parent component for editing.
    // - At most one componentLayer entry may exist, and if it does, it must be the last
    //   entry and must follow a component entry. It represents a layered view (e.g. Examples)
    //   for the current parent component.
    //
    // Asset identity is modeled separately via currentAssetId. When deriving a full
    // navigation trail for the UI, selectors treat the currentAssetId as an implicit
    // leading asset breadcrumb, followed by this within-asset stack.
    //
    id: string;
    kind: WorkbenchBreadcrumbKind;
    //
    // When kind === 'component', componentId points at the component in the
    // current asset's standardForm. For 'asset', componentId is null.
    //
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
            state.currentAssetId = nextAssetId
            //
            // When clearing the asset entirely (back to selector), there is
            // no meaningful breadcrumb history to display.
            //
            if (!nextAssetId) {
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

export const navigateToAsset = (assetIdOverride?: AssetUUID) => (dispatch: AppDispatch, getState: () => RootState) => {
    const state = getState()
    const currentAssetId = state.UI.workbench.currentAssetId
    const assetId = assetIdOverride ?? currentAssetId

    if (!assetId) {
        return
    }

    if (assetIdOverride) {
        dispatch(setCurrentAssetId(assetIdOverride))
    }

    dispatch(setBreadcrumbStack([]))
}

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

export const navigateToComponentLayer = (parentComponentId: ComponentUUID, layerComponentId: ComponentUUID) => (dispatch: AppDispatch, getState: () => RootState) => {
    const state = getState()
    const assetId = state.UI.workbench.currentAssetId
    if (!assetId) {
        return
    }
    const stack: WorkbenchBreadcrumbEntry[] = [
        { id: parentComponentId, kind: 'component', componentId: parentComponentId },
        { id: layerComponentId, kind: 'componentLayer', componentId: layerComponentId }
    ]
    dispatch(setBreadcrumbStack(stack))
}

export const navigateViaBreadcrumbIndex = (index: number) => (dispatch: AppDispatch, getState: () => RootState) => {
    const state = getState()
    const stack = state.UI.workbench.breadcrumbStack
    if (index < 0 || index >= stack.length) {
        return
    }
    dispatch(setBreadcrumbStack(stack.slice(0, index + 1)))
}

// Selectors
export const getWorkbenchOpen: Selector<boolean> = (state: RootState) => state.UI.workbench.open
export const getAuthoringMode: Selector<'play' | 'authoring'> = (state: RootState) => state.UI.workbench.authoringMode
export const getCurrentAssetId: Selector<AssetUUID | null> = (state: RootState) => state.UI.workbench.currentAssetId
export const getSecondaryContext: Selector<string | null> = (state: RootState) => state.UI.workbench.secondaryContext
export const getBreadcrumbStack: Selector<WorkbenchBreadcrumbEntry[]> = (state: RootState) => state.UI.workbench.breadcrumbStack

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
    [getCurrentAssetId, getBreadcrumbStack],
    (assetId, stack): WorkbenchView => {
        if (!assetId) {
            return null
        }
        if (!stack.length) {
            return 'asset'
        }
        const last = stack[stack.length - 1]
        if (last.kind === 'component') {
            return 'component'
        }
        if (last.kind === 'componentLayer') {
            return 'componentLayer'
        }
        return 'asset'
    }
)

export const getCurrentComponentId: Selector<string | null> = createSelector(
    getBreadcrumbStack,
    (stack): string | null => {
        const lastComponent = [...stack].reverse().find((entry) => entry.kind === 'component')
        return lastComponent?.componentId ?? null
    }
)

export const getCurrentComponentLayerId: Selector<string | null> = createSelector(
    getBreadcrumbStack,
    (stack): string | null => {
        const lastLayer = [...stack].reverse().find((entry) => entry.kind === 'componentLayer')
        return lastLayer?.componentId ?? null
    }
)

// Intermediate selector to get standard form for current asset using full RootState
const getCurrentAssetStandardForm = createSelector(
    [getCurrentAssetId, (state: RootState) => state],
    (assetId, rootState) => {
        if (!assetId) return null
        // getStandardForm(assetId) returns a selector that expects the full RootState
        // It may need other assets for inheritance/imports
        // It returns undefined if the asset doesn't exist in personalAssets.byId[assetId]
        const standardFormSelector = getStandardForm(assetId)
        return standardFormSelector(rootState) || null
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
