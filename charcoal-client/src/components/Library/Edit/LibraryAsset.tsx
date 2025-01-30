//
// LibraryAsset is a context provider (with associated useLibraryAsset
// context subscriber hook) to create component nests that all operate in the
// context of having a chosen asset that a player is examining in the library.
//
// Arguments:
//
//   - AssetId: The internal key of the asset.
//
// Context provided:
//
//   - AssetId
//

import React, { useContext, ReactChild, ReactChildren, FunctionComponent, useMemo, useCallback, useState, useEffect } from 'react'
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
    getLocalStandardForm
} from '../../../slices/personalAssets'
import { heartbeat } from '../../../slices/stateSeekingMachine/ssmHeartbeat'
import { PersonalAssetsLoadedImage, PersonalAssetsNodes } from '../../../slices/personalAssets/baseClasses'
import { getConfiguration } from '../../../slices/configuration'
import { UpdateStandardPayload } from '../../../slices/personalAssets/reducers'
import { EphemeraAssetId, EphemeraCharacterId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import { StandardFormData } from '@tonylb/mtw-wml/ts/standardize/components/dataTypes'
import { StandardForm } from '@tonylb/mtw-wml/ts/standardize'
import { DevEnvironment } from '../../../environment'

type LibraryAssetContextType = {
    assetKey: string;
    AssetId: EphemeraCharacterId | EphemeraAssetId;
    currentWML: string;
    draftWML: string;
    standardForm: StandardForm;
    localStandardForm: StandardForm;
    inheritedStandardForm: StandardFormData;
    inheritedByAssetId: { assetId: string; standardForm: StandardFormData }[];
    updateStandard: (action: UpdateStandardPayload) => void;
    loadedImages: Record<string, PersonalAssetsLoadedImage>;
    properties: Record<string, { fileName: string }>;
    save: () => void;
    readonly: boolean;
    serialized?: boolean;
    status?: keyof PersonalAssetsNodes;
    saving: boolean;
}

const LibraryAssetContext = React.createContext<LibraryAssetContextType>({
    assetKey: '',
    AssetId: 'ASSET#',
    currentWML: '',
    draftWML: '',
    standardForm: new StandardForm({ key: '', byId: {}, metaData: [] }),
    localStandardForm: new StandardForm({ key: '', byId: {}, metaData: [] }),
    inheritedStandardForm: { key: '', byId: {}, metaData: [] },
    inheritedByAssetId: [],
    updateStandard: () => {},
    properties: {},
    loadedImages: {},
    save: () => {},
    readonly: true,
    serialized: false,
    saving: false
})

type LibraryAssetProps = {
    assetKey: string;
    children?: ReactChild | ReactChildren;
    character?: boolean;
}

export const LibraryAsset: FunctionComponent<LibraryAssetProps> = ({ assetKey, children, character }) => {

    const AssetId = useMemo<EphemeraCharacterId | EphemeraAssetId>(() => (`${character ? 'CHARACTER' : 'ASSET'}#${assetKey}`), [character, assetKey])
    const currentWML = useSelector(getCurrentWML(AssetId))
    const draftWML = useSelector(getDraftWML(AssetId))
    const localStandardFormData = useSelector(getLocalStandardForm(AssetId))
    const localStandardForm = useMemo(() => (new StandardForm(localStandardFormData)), [localStandardFormData])
    const standardFormData = useSelector(getStandardForm(AssetId))
    const standardForm = useMemo(() => (new StandardForm(standardFormData)), [standardFormData])
    const pendingEdits = useSelector(getPendingEdits(AssetId))
    const inheritedStandardForm = useSelector(getInherited(AssetId))
    const inheritedByAssetId = useSelector(getInheritedByAssetId(AssetId))
    const loadedImages = useSelector(getLoadedImages(AssetId))
    const properties = useSelector(getProperties(AssetId))
    const status = useSelector(getStatus(AssetId))
    const serialized = useSelector(getSerialized(AssetId))
    const dispatch = useDispatch()
    const updateStandard = useCallback((updateAction: UpdateStandardPayload) => {
        dispatch(updateStandardAction(AssetId)(updateAction))
        dispatch(setIntent({ key: AssetId, intent: ['SCHEMADIRTY'] }))
        dispatch(heartbeat)
    }, [dispatch, AssetId])
    const save = useCallback(() => {
        dispatch(setIntent({ key: AssetId, intent: ['NEEDSAVE'] }))
        dispatch(heartbeat)
    }, [dispatch, AssetId])

    return (
        <LibraryAssetContext.Provider value={{
            assetKey,
            AssetId,
            currentWML,
            draftWML,
            localStandardForm,
            standardForm,
            inheritedStandardForm,
            inheritedByAssetId,
            updateStandard,
            properties,
            loadedImages,
            save,
            readonly: !(assetKey === 'draft'),
            serialized,
            status,
            saving: pendingEdits.length > 0
        }}>
            {children}
        </LibraryAssetContext.Provider>
    )
}

export const useLibraryAsset = () => (useContext(LibraryAssetContext))

type ImageHeaderSyntheticURL = {
    loadId: string;
    fileURL: string;
}

export const useLibraryImageURL = (key: string): string => {    
    const { loadedImages, properties } = useLibraryAsset()
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
            setSyntheticURL({
                loadId: loadedImage.loadId,
                fileURL: URL.createObjectURL(loadedImage.file)
            })
        }
        return () => {
            if (syntheticURL) {
                URL.revokeObjectURL(syntheticURL.fileURL)
            }
        }
    }, [syntheticURL, loadedImage])

    const fileURL = useMemo(() => {
        const appBaseURL = DevEnvironment ? `https://${AppBaseURL}` : ''
        return syntheticURL ? syntheticURL.fileURL : properties[key] ? `${appBaseURL}/images/${properties[key].fileName}.png` : ''
    }, [syntheticURL, properties, key])

    return fileURL

}

export default LibraryAsset
