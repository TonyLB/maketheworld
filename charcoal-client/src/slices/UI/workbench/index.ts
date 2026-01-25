import { createSlice, PayloadAction, createSelector } from '@reduxjs/toolkit'

import { RootState, Selector, AppDispatch } from '../../../store'
import { AssetUUID } from '@tonylb/mtw-base/ts/schema'
import cacheDB, { ClientSettingType } from '../../../cacheDB'
import { getStandardForm } from '../../personalAssets'
import { getAssetZone } from '../../player'

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

// Helper selector to get personalAssets node for current asset
const getCurrentAssetNode = createSelector(
    [getCurrentAssetId, (state: RootState) => state.personalAssets],
    (assetId, personalAssetsState) => {
        if (!assetId) return null
        return personalAssetsState?.[assetId] || null
    }
)

// Memoized selector that combines data from personalAssets and player slices
export const getWorkbenchAssetInfo = createSelector(
    [getCurrentAssetId, getCurrentAssetNode, (state: RootState) => state.player],
    (assetId, assetNode, playerState) => {
        if (!assetId || !assetNode) {
            return null
        }

        // Get standard form from personalAssets node
        // getStandardForm is a selector function that takes the node's publicData
        const standardFormSelector = getStandardForm(assetId)
        // Create a temporary state structure for the selector
        const tempState = {
            personalAssets: {
                [assetId]: assetNode
            }
        } as RootState
        const standardFormData = standardFormSelector(tempState)
        
        // Get asset name from shortName
        // StandardFormData.shortName can be StandardLiteral or string
        let assetName = 'Untitled'
        if (standardFormData?.shortName) {
            if (typeof standardFormData.shortName === 'string') {
                assetName = standardFormData.shortName
            } else if (standardFormData.shortName?.toJSON) {
                assetName = standardFormData.shortName.toJSON()
            }
        }

        // Get zone from player slice
        const zoneSelector = getAssetZone(assetId)
        const zone = zoneSelector(playerState) || 'Draft'

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
