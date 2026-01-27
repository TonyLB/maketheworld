import { createSlice, PayloadAction, createSelector } from '@reduxjs/toolkit'

import { RootState, Selector, AppDispatch } from '../../../store'
import { AssetUUID } from '@tonylb/mtw-base/ts/schema'
import cacheDB, { ClientSettingType } from '../../../cacheDB'
import { getStandardForm } from '../../personalAssets'
import { getAssetZone, getMyAssets } from '../../player'
import { AssetKey } from '@tonylb/mtw-utilities/ts/types'

type WorkbenchBreadcrumbKind = 'asset' | 'component'

export type WorkbenchBreadcrumbEntry = {
    //
    // NOTE: Breadcrumbs track **navigation history**, not schema ancestry.
    // For now we assume a simple stack model (push on deeper navigation,
    // pop when going \"back\" or clicking a breadcrumb).
    //
    // In future we may support sibling navigation patterns (for example,
    // clicking a Feature link inside a room-example description) that are
    // more naturally represented as \"pop some, then push a different branch\"
    // rather than a pure stack. The current model is intentionally small and
    // conservative so we can evolve it as those needs become concrete.
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
    currentView: 'asset' | 'component' | null;
    currentComponentId: string | null;
    breadcrumbStack: WorkbenchBreadcrumbEntry[];
}

const initialState: WorkbenchState = {
    open: false,
    authoringMode: 'play',
    currentAssetId: null,
    secondaryContext: null,
    currentView: null,
    currentComponentId: null,
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
            // When the asset changes, treat that as a new navigation root:
            // - reset view to the asset-level editor
            // - clear component selection
            // - initialize breadcrumbs to just the asset
            //
            if (nextAssetId && nextAssetId !== prevAssetId) {
                state.currentView = 'asset'
                state.currentComponentId = null
                state.breadcrumbStack = [{
                    id: nextAssetId,
                    kind: 'asset',
                    componentId: null
                }]
            }
            //
            // When clearing the asset entirely (back to selector), there is
            // no meaningful breadcrumb history to display.
            //
            if (!nextAssetId) {
                state.currentView = null
                state.currentComponentId = null
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
                // When workbench settings are hydrated (e.g., on app startup), we may already have
                // a currentAssetId without having gone through setCurrentAssetId(). In that case,
                // initialize a root breadcrumb on first load so that later component navigation
                // can extend it into Asset → Component paths rather than starting at the component.
                //
                if (nextAssetId && state.breadcrumbStack.length === 0) {
                    state.currentView = state.currentView ?? 'asset'
                    state.currentComponentId = state.currentComponentId ?? null
                    state.breadcrumbStack = [{
                        id: nextAssetId,
                        kind: 'asset',
                        componentId: null
                    }]
                }
                //
                // If settings explicitly clear currentAssetId, also clear breadcrumb history so the
                // header falls back to the asset selector state.
                //
                if (!nextAssetId) {
                    state.currentView = null
                    state.currentComponentId = null
                    state.breadcrumbStack = []
                }
            }
        },
        setCurrentView(state, action: PayloadAction<'asset' | 'component' | null>) {
            state.currentView = action.payload
        },
        setCurrentComponentId(state, action: PayloadAction<string | null>) {
            state.currentComponentId = action.payload
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
    setCurrentView,
    setCurrentComponentId,
    pushBreadcrumb,
    popBreadcrumbToIndex,
    resetBreadcrumbs
} = workbenchSlice.actions

// Selectors
export const getWorkbenchOpen: Selector<boolean> = (state: RootState) => state.UI.workbench.open
export const getAuthoringMode: Selector<'play' | 'authoring'> = (state: RootState) => state.UI.workbench.authoringMode
export const getCurrentAssetId: Selector<AssetUUID | null> = (state: RootState) => state.UI.workbench.currentAssetId
export const getSecondaryContext: Selector<string | null> = (state: RootState) => state.UI.workbench.secondaryContext
export const getCurrentView: Selector<'asset' | 'component' | null> = (state: RootState) => state.UI.workbench.currentView
export const getCurrentComponentId: Selector<string | null> = (state: RootState) => state.UI.workbench.currentComponentId
export const getBreadcrumbStack: Selector<WorkbenchBreadcrumbEntry[]> = (state: RootState) => state.UI.workbench.breadcrumbStack

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
