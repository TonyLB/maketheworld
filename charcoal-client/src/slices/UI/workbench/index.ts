import { createSlice, PayloadAction, createSelector } from '@reduxjs/toolkit'

import { RootState, Selector, AppDispatch } from '../../../store'
import { AssetUUID } from '@tonylb/mtw-base/ts/schema'
import cacheDB, { ClientSettingType } from '../../../cacheDB'
import { getStandardForm } from '../../personalAssets'
import { getAssetZone, getMyAssets } from '../../player'
import { AssetKey } from '@tonylb/mtw-utilities/ts/types'

interface WorkbenchState {
    open: boolean;
    authoringMode: 'play' | 'authoring';
    currentAssetId: AssetUUID | null;
    secondaryContext: string | null;
}

const initialState: WorkbenchState = {
    open: false,
    authoringMode: 'play',
    currentAssetId: null,
    secondaryContext: null
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
            state.currentAssetId = action.payload
        },
        setAuthoringMode(state, action: PayloadAction<'play' | 'authoring'>) {
            state.authoringMode = action.payload
        },
        setSecondaryContext(state, action: PayloadAction<string | null>) {
            state.secondaryContext = action.payload
        },
        receiveWorkbenchSettings(state, action: PayloadAction<Partial<Pick<WorkbenchState, 'currentAssetId'>>>) {
            if (action.payload.currentAssetId !== undefined) {
                state.currentAssetId = action.payload.currentAssetId
            }
        }
    }
})

export const { openWorkbench, closeWorkbench, setCurrentAssetId, setAuthoringMode, setSecondaryContext, receiveWorkbenchSettings } = workbenchSlice.actions

// Selectors
export const getWorkbenchOpen: Selector<boolean> = (state: RootState) => state.UI.workbench.open
export const getAuthoringMode: Selector<'play' | 'authoring'> = (state: RootState) => state.UI.workbench.authoringMode
export const getCurrentAssetId: Selector<AssetUUID | null> = (state: RootState) => state.UI.workbench.currentAssetId
export const getSecondaryContext: Selector<string | null> = (state: RootState) => state.UI.workbench.secondaryContext

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
