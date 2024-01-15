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
    getNormalized,
    getLoadedImages,
    setIntent,
    getProperties,
    updateNormal as updateNormalAction,
    getDraftWML,
    getImportData,
    getStatus,
    getSerialized
} from '../../../slices/personalAssets'
import { getPlayer } from '../../../slices/player'
import { heartbeat } from '../../../slices/stateSeekingMachine/ssmHeartbeat'
import { NormalForm, NormalComponent, ComponentRenderItem, NormalExit, isNormalExit, isNormalComponent, NormalImport, isNormalImport, NormalItem } from '@tonylb/mtw-wml/dist/normalize/baseClasses'
import { objectFilter } from '../../../lib/objects'
import { PersonalAssetsLoadedImage, PersonalAssetsNodes } from '../../../slices/personalAssets/baseClasses'
import { getConfiguration } from '../../../slices/configuration'
import { UpdateNormalPayload } from '../../../slices/personalAssets/reducers'
import Normalizer from '@tonylb/mtw-wml/dist/normalize'
import { EphemeraAssetId, EphemeraCharacterId } from '@tonylb/mtw-interfaces/dist/baseClasses'
import { selectName } from '@tonylb/mtw-wml/dist/normalize/selectors/name'
import { selectRender } from '@tonylb/mtw-wml/dist/normalize/selectors/render'
import { GenericTree } from '@tonylb/mtw-wml/dist/sequence/tree/baseClasses'
import { SchemaOutputTag } from '@tonylb/mtw-wml/dist/simpleSchema/baseClasses'

type LibraryAssetContextType = {
    assetKey: string;
    AssetId: EphemeraCharacterId | EphemeraAssetId | null;
    currentWML: string;
    draftWML: string;
    normalForm: NormalForm;
    importData: (assetKey: string) => NormalForm | undefined;
    updateNormal: (action: UpdateNormalPayload) => void;
    loadedImages: Record<string, PersonalAssetsLoadedImage>;
    properties: Record<string, { fileName: string }>;
    components: Record<string, AssetComponent>;
    rooms: Record<string, AssetComponent>;
    exits: Record<string, NormalExit>;
    features: Record<string, AssetComponent>;
    save: () => void;
    readonly: boolean;
    serialized: boolean;
    status?: keyof PersonalAssetsNodes;
}

const LibraryAssetContext = React.createContext<LibraryAssetContextType>({
    assetKey: '',
    AssetId: null,
    currentWML: '',
    draftWML: '',
    normalForm: {},
    importData: () => (undefined),
    updateNormal: () => {},
    properties: {},
    loadedImages: {},
    components: {},
    rooms: {},
    exits: {},
    features: {},
    save: () => {},
    readonly: true,
    serialized: false
})

type LibraryAssetProps = {
    assetKey: string;
    children?: ReactChild | ReactChildren;
    character?: boolean;
}

export type AssetComponent = {
    tag: NormalItem["tag"];
    localName: GenericTree<SchemaOutputTag>;
    localRender: GenericTree<SchemaOutputTag>;
    inheritedName: GenericTree<SchemaOutputTag>;
    inheritedRender: GenericTree<SchemaOutputTag>;
    name: GenericTree<SchemaOutputTag>;
    render: GenericTree<SchemaOutputTag>;
    importFrom?: string;
}

const assetComponents = ({ normalForm, importData }: { normalForm: NormalForm, importData: (assetKey: string) => NormalForm | undefined }): Record<string, AssetComponent> => {
    const componentNormals = Object.values(normalForm).filter((item) => (isNormalComponent(item))) as NormalComponent[]
    const normalizer = new Normalizer()
    normalizer.loadNormal(normalForm)

    const roomReturns = componentNormals
        .map((component) => {
            const localName = normalizer.select({ key: component.key, selector: selectName })
            // const localName = (component.appearances
            //     .filter(({ contextStack }) => (!contextStack.find(({ tag }) => (tag === 'If'))))
            //     .map(({ name = [] }) => name)
            //     .reduce((previous, name) => ([ ...previous, ...name ]), [])
            //     .map((item) => ((item.tag === 'String') ? item.value : ''))
            //     .join('')) || ''
            const localRender = normalizer.select({ key: component.key, selector: selectRender })
            // const localRender = component.appearances
            //     .filter(({ contextStack }) => (!contextStack.find(({ tag }) => (tag === 'If'))))
            //     .map(({ render = [] }) => render)
            //     .reduce((previous, render) => ([ ...previous, ...render ]), [])
            const importRef = component.appearances.map(({ contextStack }) => (contextStack.find(({ tag }) => (tag === 'Import')))).find((value) => (Boolean(value)))
            const importItemCheck: NormalItem | undefined = importRef ? normalForm[importRef.key] : undefined
            const importItem: NormalImport | undefined = (importItemCheck && isNormalImport(importItemCheck)) ? importItemCheck : undefined
            if (importItem) {
                const awayKey = importItem.mapping[component.key]
                if (awayKey) {
                    const importedNormal = importData(importItem.from)
                    if (importedNormal) {
                        const importNormalizer = new Normalizer()
                        importNormalizer.loadNormal(importedNormal)
                        const inheritedItem = importedNormal[awayKey.key]
                        if (inheritedItem && isNormalComponent(inheritedItem)) {
                            const inheritedName = importNormalizer.select({ key: awayKey.key, selector: selectName })
                            const inheritedRender = importNormalizer.select({ key: awayKey.key, selector: selectRender })
                            return { [component.key]: {
                                tag: component.tag,
                                localName,
                                localRender,
                                inheritedName,
                                inheritedRender,
                                name: [ ...inheritedName, ...localName ],
                                render: [...inheritedRender, ...localRender],
                                importFrom: importItem.from
                            }}
                        }
                    }
                }
            }
            return { [component.key]: {
                tag: component.tag,
                localName,
                localRender,
                inheritedName: [],
                inheritedRender: [],
                name: localName,
                render: localRender
            }}
        })
    
    return Object.assign({}, ...roomReturns)
}

export const LibraryAsset: FunctionComponent<LibraryAssetProps> = ({ assetKey, children, character }) => {

    const AssetId = useMemo<EphemeraCharacterId | EphemeraAssetId>(() => (`${character ? 'CHARACTER' : 'ASSET'}#${assetKey}`), [character, assetKey])
    const currentWML = useSelector(getCurrentWML(AssetId))
    const draftWML = useSelector(getDraftWML(AssetId))
    const normalForm = useSelector(getNormalized(AssetId))
    const importData = useSelector(getImportData(AssetId))
    const loadedImages = useSelector(getLoadedImages(AssetId))
    const properties = useSelector(getProperties(AssetId))
    const status = useSelector(getStatus(AssetId))
    const serialized = useSelector(getSerialized(AssetId))
    const dispatch = useDispatch()
    const updateNormal = useCallback((updateAction: UpdateNormalPayload) => {
        dispatch(updateNormalAction(AssetId)(updateAction))
        dispatch(setIntent({ key: AssetId, intent: ['NORMALDIRTY'] }))
        dispatch(heartbeat)
    }, [dispatch, AssetId])
    const components = useMemo<Record<string, AssetComponent>>(() => ( assetComponents({ normalForm, importData }) ), [normalForm, importData])
    const rooms = useMemo<Record<string, AssetComponent>>(() => ( objectFilter(components, ({ tag }) => (tag === 'Room')) ), [components])
    const exits = useMemo<Record<string, NormalExit>>(() => ( objectFilter(normalForm, isNormalExit) ), [components])
    const features = useMemo<Record<string, AssetComponent>>(() => ( objectFilter(components, ({ tag }) => (tag === 'Feature')) ), [components])
    const save = useCallback(() => {
        dispatch(setIntent({ key: AssetId, intent: ['NEEDSAVE'] }))
        dispatch(heartbeat)
    }, [dispatch, AssetId])
    const { currentDraft } = useSelector(getPlayer)

    return (
        <LibraryAssetContext.Provider value={{
            assetKey,
            AssetId,
            currentWML,
            draftWML,
            normalForm,
            importData,
            updateNormal,
            properties,
            loadedImages,
            components,
            rooms,
            exits,
            features,
            save,
            readonly: !(currentDraft === assetKey),
            serialized,
            status
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
