//
// useWorkbenchAsset is a hook that provides the same interface as useLibraryAsset
// but automatically derives the asset ID from the workbench Redux slice (currentAssetId)
// instead of requiring it as a prop. This enables seamless migration of existing
// editing interfaces to the workbench context.
//

import { useMemo, useCallback, useEffect, useState } from 'react'
import { useSelector, useDispatch } from 'react-redux'

import {
    getLoadedImages,
    setIntent,
    getProperties,
    updateStandard as updateStandardAction,
    getStatus,
    getSerialized,
    getStandardForm,
    getInherited,
    getInheritedByAssetId,
    getPendingEdits,
    getLocalStandardForm,
    addItem
} from '../../../slices/personalAssets'
import { heartbeat } from '../../../slices/stateSeekingMachine/ssmHeartbeat'
import { PersonalAssetsLoadedImage, PersonalAssetsNodes, PersonalAssetsPublic } from '../../../slices/personalAssets/baseClasses'
import { UpdateStandardPayload } from '../../../slices/personalAssets/reducers'
import { AssetUUID, isSchemaAssetUUID } from '@tonylb/mtw-base/ts/schema'
import StandardReference from '@tonylb/mtw-wml/ts/standardize/components/reference'
import { StandardFormData } from '@tonylb/mtw-wml/ts/standardize/components/dataTypes'
import { StandardForm } from '@tonylb/mtw-wml/ts/standardize'
import { getAssetZone } from '../../../slices/player'
import { getCurrentAssetId } from '../../../slices/UI/workbench'
import { AssetKey } from '@tonylb/mtw-utilities/ts/types'
import type { AnyAction } from 'redux'
import type { ThunkDispatch } from 'redux-thunk'
import { RootState } from '../../../store'
import { getConfiguration } from '../../../slices/configuration'
import { DevEnvironment } from '../../../environment'
import type { ScopedInstrumentationOptions } from '../../../testing/scopedInstrumentation'
import {
    materializeComponentInAsset,
    type MaterializeSpec
} from './consistency'

type WorkbenchAssetContextType = {
    assetKey: string;
    AssetId: AssetUUID;
    standardForm: StandardForm;
    localStandardForm: StandardForm;
    inheritedStandardForm: StandardForm;
    inheritedByAssetId: { assetId: string; standardForm: StandardFormData }[];
    updateStandard: (action: UpdateStandardPayload, options?: ScopedInstrumentationOptions) => void;
    materializeComponentInAsset: (spec: MaterializeSpec) => Promise<StandardReference>;
    loadedImages: Record<string, PersonalAssetsLoadedImage>;
    properties: Record<string, { fileName: string }>;
    readonly: boolean;
    serialized?: boolean;
    status?: keyof PersonalAssetsNodes;
    saving: boolean;
    pendingEdits: PersonalAssetsPublic['pendingEdits'];
}

// Uninitialized values matching LibraryAssetContext default context
const uninitializedValues: WorkbenchAssetContextType = {
    assetKey: '',
    AssetId: 'ASSET#uninitialized',
    standardForm: new StandardForm({ universalKey: 'ASSET#uninitialized', components: [], metaData: [] }),
    localStandardForm: new StandardForm({ universalKey: 'ASSET#uninitialized', components: [], metaData: [] }),
    inheritedStandardForm: new StandardForm({ universalKey: 'ASSET#uninitialized', components: [], metaData: [] }),
    inheritedByAssetId: [],
    updateStandard: () => {},
    materializeComponentInAsset: async () => {
        throw new Error('No asset selected')
    },
    properties: {},
    loadedImages: {},
    readonly: true,
    serialized: false,
    saving: false,
    pendingEdits: []
}

export const useWorkbenchAsset = (): WorkbenchAssetContextType => {
    const currentAssetId = useSelector(getCurrentAssetId)
    const dispatch = useDispatch<ThunkDispatch<RootState, unknown, AnyAction>>()
    
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
    // The default desired states (FRESH, SCHEMADIRTY) will trigger the fetch path
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
    const updateStandard = useCallback((updateAction: UpdateStandardPayload, options?: ScopedInstrumentationOptions) => {
        dispatch(updateStandardAction(AssetId)(updateAction, options))
        dispatch(setIntent({ key: AssetId, intent: ['SCHEMADIRTY'] }))
        dispatch(heartbeat)
    }, [dispatch, AssetId])

    const materializeComponentInAssetFn = useCallback(
        (spec: MaterializeSpec): Promise<StandardReference> => {
            if (!currentAssetId || !isSchemaAssetUUID(AssetId)) {
                return Promise.reject(new Error('No asset selected'))
            }
            return dispatch(materializeComponentInAsset(AssetId)(spec))
        },
        [dispatch, currentAssetId, AssetId]
    )
    
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
        localStandardForm,
        standardForm,
        inheritedStandardForm,
        inheritedByAssetId,
        updateStandard,
        materializeComponentInAsset: materializeComponentInAssetFn,
        properties: properties ?? {},
        loadedImages,
        readonly,
        serialized,
        status,
        saving: (pendingEdits?.length ?? 0) > 0,
        pendingEdits
    }
}

type ImageHeaderSyntheticURL = {
    loadId: string;
    fileURL: string;
}

export const useLibraryImageURL = (key: string): string => {    
    const { loadedImages, properties } = useWorkbenchAsset()
    const { AppBaseURL = '' } = useSelector(getConfiguration)
    const [syntheticURL, setSyntheticURL] = useState<ImageHeaderSyntheticURL | undefined>()

    const loadedImage = useMemo(() => (
        loadedImages[key]
    ), [loadedImages, key])

    useEffect(() => {
        if (loadedImage?.loadId !== syntheticURL?.loadId) {
            if (syntheticURL) {
                URL.revokeObjectURL(syntheticURL.fileURL)
            }
            if (loadedImage) {
                setSyntheticURL({
                    loadId: loadedImage.loadId,
                    fileURL: URL.createObjectURL(loadedImage.file)
                })
            } else {
                setSyntheticURL(undefined)
            }
        }
        return () => {
            if (syntheticURL) {
                URL.revokeObjectURL(syntheticURL.fileURL)
            }
        }
    }, [syntheticURL, loadedImage])

    const fileURL = useMemo(() => {
        const appBaseURL = DevEnvironment ? `https://${AppBaseURL}` : ''
        // TODO: Restore when image uuid-as-filename refactor lands. properties[key].fileName
        // will become properties[key] or derived from image uuid. See personalAssets AGENT.md "Deprecated: Image properties (fetch)".
        return syntheticURL ? syntheticURL.fileURL : properties[key] ? `${appBaseURL}/images/${properties[key].fileName}.png` : ''
    }, [syntheticURL, properties, key, AppBaseURL])

    return fileURL
}
