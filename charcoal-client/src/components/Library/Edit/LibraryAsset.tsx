/** @jsxImportSource @emotion/react */

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
    getImportDefaults,
    getNormalized,
    getWMLQuery,
    getLoadedImages,
    setCurrentWML,
    setIntent,
    getProperties,
    updateNormal as updateNormalAction,
    getDraftWML
} from '../../../slices/personalAssets'
import { heartbeat } from '../../../slices/stateSeekingMachine/ssmHeartbeat'
import { WMLQuery } from '@tonylb/mtw-wml/dist/wmlQuery'
import { NormalForm, NormalComponent, ComponentRenderItem, NormalExit, isNormalExit, isNormalComponent } from '@tonylb/mtw-wml/dist/normalize/baseClasses'
import { objectFilter } from '../../../lib/objects'
import { AssetClientImportDefaults } from '@tonylb/mtw-interfaces/dist/asset'
import { PersonalAssetsLoadedImage } from '../../../slices/personalAssets/baseClasses'
import { getConfiguration } from '../../../slices/configuration'
import { UpdateNormalPayload } from '../../../slices/personalAssets/reducers'

type LibraryAssetContextType = {
    assetKey: string;
    AssetId: string;
    currentWML: string;
    draftWML: string;
    normalForm: NormalForm;
    importDefaults: AssetClientImportDefaults["defaultsByKey"];
    updateNormal: (action: UpdateNormalPayload) => void;
    loadedImages: Record<string, PersonalAssetsLoadedImage>;
    properties: Record<string, { fileName: string }>;
    components: Record<string, AssetComponent>;
    rooms: Record<string, AssetComponent>;
    exits: Record<string, NormalExit>;
    features: Record<string, AssetComponent>;
    save: () => void;
}

const LibraryAssetContext = React.createContext<LibraryAssetContextType>({
    assetKey: '',
    AssetId: '',
    currentWML: '',
    draftWML: '',
    normalForm: {},
    importDefaults: {},
    updateNormal: () => {},
    properties: {},
    loadedImages: {},
    components: {},
    rooms: {},
    exits: {},
    features: {},
    save: () => {}
})

type LibraryAssetProps = {
    assetKey: string;
    children?: ReactChild | ReactChildren;
    character?: boolean;
}

export type AssetComponent = {
    tag: string;
    localName: ComponentRenderItem[];
    localRender: ComponentRenderItem[];
    defaultName: ComponentRenderItem[];
    defaultRender?: ComponentRenderItem[];
    name: ComponentRenderItem[];
    render: ComponentRenderItem[];
}

const assetComponents = ({ normalForm, importDefaults }: { normalForm: NormalForm, importDefaults: AssetClientImportDefaults["defaultsByKey"] }): Record<string, AssetComponent> => {
    const componentNormals = Object.values(normalForm).filter((item) => (isNormalComponent(item))) as NormalComponent[]

    const roomReturns = componentNormals
        .map((component) => {
            const localName = (component.appearances
                .filter(({ contextStack }) => (!contextStack.find(({ tag }) => (tag === 'If'))))
                .map(({ name = [] }) => name)
                .reduce((previous, name) => ([ ...previous, ...name ]), [])
                .map((item) => ((item.tag === 'String') ? item.value : ''))
                .join('')) || ''
            const countRenderAppearances = component.appearances
                .filter(({ contextStack }) => (!contextStack.find(({ tag }) => (tag === 'If'))))
                .length
            const localRender = component.appearances
                .filter(({ contextStack }) => (!contextStack.find(({ tag }) => (tag === 'If'))))
                .map(({ render = [] }) => render)
                .reduce((previous, render) => ([ ...previous, ...render ]), [])
            const defaultName = importDefaults[component.key]?.Name || []
            const defaultRender = importDefaults[component.key]?.Description || []
            return { [component.key]: {
                tag: component.tag,
                localName,
                localRender,
                defaultName,
                defaultRender,
                name: [ ...defaultName, ...localName ],
                render: [...(defaultRender || []), ...localRender]
            }}
        })
    
    return Object.assign({}, ...roomReturns)
}

export const LibraryAsset: FunctionComponent<LibraryAssetProps> = ({ assetKey, children, character }) => {

    const AssetId = useMemo<string>(() => (`${character ? 'CHARACTER' : 'ASSET'}#${assetKey}`), [character, assetKey])
    const currentWML = useSelector(getCurrentWML(AssetId))
    const draftWML = useSelector(getDraftWML(AssetId))
    const normalForm = useSelector(getNormalized(AssetId))
    const importDefaults = useSelector(getImportDefaults(AssetId))
    const loadedImages = useSelector(getLoadedImages(AssetId))
    const properties = useSelector(getProperties(AssetId))
    const dispatch = useDispatch()
    const updateNormal = useCallback((updateAction: UpdateNormalPayload) => {
        dispatch(updateNormalAction(AssetId)(updateAction))
        dispatch(setIntent({ key: AssetId, intent: ['NORMALDIRTY'] }))
        dispatch(heartbeat)
    }, [dispatch, AssetId])
    const components = useMemo<Record<string, AssetComponent>>(() => ( assetComponents({ normalForm, importDefaults }) ), [normalForm, importDefaults])
    const rooms = useMemo<Record<string, AssetComponent>>(() => ( objectFilter(components, ({ tag }) => (tag === 'Room')) ), [components])
    const exits = useMemo<Record<string, NormalExit>>(() => ( objectFilter(normalForm, isNormalExit) ), [components])
    const features = useMemo<Record<string, AssetComponent>>(() => ( objectFilter(components, ({ tag }) => (tag === 'Feature')) ), [components])
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
            normalForm,
            importDefaults,
            updateNormal,
            properties,
            loadedImages,
            components,
            rooms,
            exits,
            features,
            save
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
        const appBaseURL = process.env.NODE_ENV === 'development' ? `https://${AppBaseURL}` : ''
        return syntheticURL ? syntheticURL.fileURL : properties[key] ? `${appBaseURL}/images/${properties[key].fileName}.png` : ''
    }, [syntheticURL, properties, key])

    return fileURL

}

export default LibraryAsset
