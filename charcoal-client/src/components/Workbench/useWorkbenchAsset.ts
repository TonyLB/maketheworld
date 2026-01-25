//
// useWorkbenchAsset is a hook that provides the same interface as useLibraryAsset
// but automatically derives the asset ID from the workbench Redux slice (currentAssetId)
// instead of requiring it as a prop. This enables seamless migration of existing
// editing interfaces to the workbench context.
//

import { useMemo, useCallback, useEffect } from 'react'
import { useSelector, useDispatch } from 'react-redux'

import {
    getCurrentWML,
    getLoadedImages,
    setIntent,
    getProperties,
    updateStandard as updateStandardAction,
    getDraftWML,
    getStatus,
    getSerialized,
    getStandardForm,
    getInherited,
    getInheritedByAssetId,
    getPendingEdits,
    getLocalStandardForm,
    addItem
} from '../../slices/personalAssets'
import { heartbeat } from '../../slices/stateSeekingMachine/ssmHeartbeat'
import { PersonalAssetsLoadedImage, PersonalAssetsNodes } from '../../slices/personalAssets/baseClasses'
import { UpdateStandardPayload } from '../../slices/personalAssets/reducers'
import { AssetUUID } from '@tonylb/mtw-base/ts/schema'
import { StandardFormData } from '@tonylb/mtw-wml/ts/standardize/components/dataTypes'
import { StandardForm } from '@tonylb/mtw-wml/ts/standardize'
import { getAssetZone } from '../../slices/player'
import { getCurrentAssetId } from '../../slices/UI/workbench'
import { AssetKey } from '@tonylb/mtw-utilities/ts/types'
import { RootState } from '../../store'

type WorkbenchAssetContextType = {
    assetKey: string;
    AssetId: AssetUUID;
    currentWML: string;
    draftWML: string;
    standardForm: StandardForm;
    localStandardForm: StandardForm;
    inheritedStandardForm: StandardForm;
    inheritedByAssetId: { assetId: string; standardForm: StandardFormData }[];
    updateStandard: (action: UpdateStandardPayload) => void;
    loadedImages: Record<string, PersonalAssetsLoadedImage>;
    properties: Record<string, { fileName: string }>;
    readonly: boolean;
    serialized?: boolean;
    status?: keyof PersonalAssetsNodes;
    saving: boolean;
}

// Uninitialized values matching LibraryAssetContext default context
const uninitializedValues: WorkbenchAssetContextType = {
    assetKey: '',
    AssetId: 'ASSET#uninitialized',
    currentWML: '',
    draftWML: '',
    standardForm: new StandardForm({ universalKey: 'ASSET#uninitialized', components: [], metaData: [] }),
    localStandardForm: new StandardForm({ universalKey: 'ASSET#uninitialized', components: [], metaData: [] }),
    inheritedStandardForm: new StandardForm({ universalKey: 'ASSET#uninitialized', components: [], metaData: [] }),
    inheritedByAssetId: [],
    updateStandard: () => {},
    properties: {},
    loadedImages: {},
    readonly: true,
    serialized: false,
    saving: false
}

export const useWorkbenchAsset = (): WorkbenchAssetContextType => {
    const currentAssetId = useSelector(getCurrentAssetId)
    const dispatch = useDispatch()
    
    // Normalize asset ID and derive AssetId
    // AssetKey normalizes to 'ASSET#uuid' format
    const AssetId = useMemo<AssetUUID>(() => {
        if (!currentAssetId) {
            return uninitializedValues.AssetId as AssetUUID
        }
        // AssetKey normalizes the ID to proper format
        return AssetKey(currentAssetId) as AssetUUID
    }, [currentAssetId])
    
    // Check if asset exists in personalAssets.byId and load it if not
    // This ensures the asset is available for selectors to work with
    const assetExists = useSelector((state: RootState): boolean => {
        if (!currentAssetId) return false
        return !!state.personalAssets.byId[currentAssetId]
    })
    
    // Load asset if it doesn't exist (idempotent - won't create duplicates)
    // Start in INITIAL state (default) which will wait for lifeline connection
    // The default desired states (FRESH, WMLDIRTY, SCHEMADIRTY) will trigger the fetch path
    // This lets the state machine handle the lifeline condition naturally when transitioning from INITIAL
    useEffect(() => {
        if (currentAssetId && !assetExists) {
            dispatch(addItem({ key: currentAssetId }))
            dispatch(heartbeat)
        }
    }, [currentAssetId, assetExists, dispatch])
    
    // Extract assetKey (UUID portion after #)
    const assetKey = useMemo(() => {
        if (!currentAssetId) {
            return uninitializedValues.assetKey
        }
        const normalized = AssetKey(currentAssetId)
        // Extract UUID part after the #
        const parts = normalized.split('#')
        return parts.length > 1 ? parts[1] : parts[0]
    }, [currentAssetId])
    
    // Always call all hooks unconditionally (Rules of Hooks)
    // Use AssetId even when currentAssetId is null (will use default 'ASSET#uninitialized')
    const currentWML = useSelector(getCurrentWML(AssetId))
    const draftWML = useSelector(getDraftWML(AssetId))
    const localStandardFormData = useSelector(getLocalStandardForm(AssetId))
    const localStandardForm = useMemo(() => {
        // Handle undefined from selectors when asset doesn't exist (unlike LibraryAsset which always has a valid AssetId)
        if (localStandardFormData === undefined) {
            return uninitializedValues.localStandardForm
        }
        return new StandardForm(localStandardFormData)
    }, [localStandardFormData])
    const standardFormData = useSelector(getStandardForm(AssetId))
    const standardForm = useMemo(() => {
        // Handle undefined from selectors when asset doesn't exist
        if (standardFormData === undefined) {
            return uninitializedValues.standardForm
        }
        return new StandardForm(standardFormData)
    }, [standardFormData])
    const pendingEdits = useSelector(getPendingEdits(AssetId))
    const inheritedStandardFormData = useSelector(getInherited(AssetId))
    const inheritedStandardForm = useMemo(() => {
        // Handle undefined from selectors when asset doesn't exist
        if (inheritedStandardFormData === undefined) {
            return uninitializedValues.inheritedStandardForm
        }
        return new StandardForm(inheritedStandardFormData)
    }, [inheritedStandardFormData])
    const inheritedByAssetId = useSelector(getInheritedByAssetId(AssetId))
    const loadedImages = useSelector(getLoadedImages(AssetId))
    const properties = useSelector(getProperties(AssetId))
    const status = useSelector(getStatus(AssetId))
    const serialized = useSelector(getSerialized(AssetId))
    const zone = useSelector(getAssetZone(AssetId))
    const updateStandard = useCallback((updateAction: UpdateStandardPayload) => {
        dispatch(updateStandardAction(AssetId)(updateAction))
        dispatch(setIntent({ key: AssetId, intent: ['SCHEMADIRTY'] }))
        dispatch(heartbeat)
    }, [dispatch, AssetId])
    
    // readonly is false for Draft zone assets, true for all others
    const readonly = zone !== 'Draft'
    
    // If no asset is selected, return uninitialized values
    // But we still call all hooks above to maintain hook order
    if (!currentAssetId) {
        return uninitializedValues
    }
    
    return {
        assetKey,
        AssetId,
        currentWML,
        draftWML,
        localStandardForm,
        standardForm,
        inheritedStandardForm,
        inheritedByAssetId,
        updateStandard,
        properties: properties ?? {},
        loadedImages,
        readonly,
        serialized,
        status,
        saving: (pendingEdits?.length ?? 0) > 0
    }
}
