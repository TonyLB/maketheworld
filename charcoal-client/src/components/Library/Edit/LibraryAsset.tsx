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
    updateSchema as updateSchemaAction,
    getDraftWML,
    getStatus,
    getSerialized,
    getSchema,
    getStandardForm,
    getInherited,
    getBaseSchema
} from '../../../slices/personalAssets'
import { getPlayer } from '../../../slices/player'
import { heartbeat } from '../../../slices/stateSeekingMachine/ssmHeartbeat'
import { NormalForm, NormalComponent, NormalExit, isNormalExit, isNormalComponent, NormalImport, isNormalImport, NormalItem, isNormalReference } from '@tonylb/mtw-wml/dist/normalize/baseClasses'
import { objectFilter } from '../../../lib/objects'
import { PersonalAssetsLoadedImage, PersonalAssetsNodes } from '../../../slices/personalAssets/baseClasses'
import { getConfiguration } from '../../../slices/configuration'
import { UpdateSchemaPayload } from '../../../slices/personalAssets/reducers'
import Normalizer from '@tonylb/mtw-wml/dist/normalize'
import { EphemeraAssetId, EphemeraCharacterId } from '@tonylb/mtw-interfaces/dist/baseClasses'
import { selectName } from '@tonylb/mtw-wml/dist/normalize/selectors/name'
import { selectRender } from '@tonylb/mtw-wml/dist/normalize/selectors/render'
import { GenericTree, TreeId } from '@tonylb/mtw-wml/dist/tree/baseClasses'
import { SchemaOutputTag, SchemaTag, isSchemaImport } from '@tonylb/mtw-wml/dist/schema/baseClasses'
import { StandardComponent, StandardForm } from '@tonylb/mtw-wml/dist/standardize/baseClasses'
import { Standardizer } from '@tonylb/mtw-wml/dist/standardize'

type LibraryAssetContextType = {
    assetKey: string;
    AssetId: EphemeraCharacterId | EphemeraAssetId | null;
    currentWML: string;
    draftWML: string;
    normalForm: NormalForm;
    schema: GenericTree<SchemaTag, TreeId>;
    baseSchema: GenericTree<SchemaTag, TreeId>;
    standardForm: StandardForm;
    combinedStandardForm: StandardForm;
    inheritedStandardForm: StandardForm;
    updateSchema: (action: UpdateSchemaPayload) => void;
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
    select: <Output>(args: { key?: string; selector: (tree: GenericTree<SchemaTag, TreeId>, options?: { tag: string, key: string }) => Output }) => Output;
}

const LibraryAssetContext = React.createContext<LibraryAssetContextType>({
    assetKey: '',
    AssetId: null,
    currentWML: '',
    draftWML: '',
    normalForm: {},
    schema: [],
    baseSchema: [],
    standardForm: { key: '', tag: 'Asset', byId: {}, metaData: [] },
    combinedStandardForm: { key: '', tag: 'Asset', byId: {}, metaData: [] },
    inheritedStandardForm: { key: '', tag: 'Asset', byId: {}, metaData: [] },
    updateSchema: () => {},
    properties: {},
    loadedImages: {},
    components: {},
    rooms: {},
    exits: {},
    features: {},
    save: () => {},
    readonly: true,
    serialized: false,
    select: () => { throw new Error('Undefined selector in LibraryAsset') }
})

type LibraryAssetProps = {
    assetKey: string;
    children?: ReactChild | ReactChildren;
    character?: boolean;
}

export type AssetComponent = {
    tag: NormalItem["tag"];
    name: GenericTree<SchemaOutputTag>;
    render: GenericTree<SchemaOutputTag>;
    importFrom?: string;
}

const assetComponents = ({ normalForm }: { normalForm: NormalForm }): Record<string, AssetComponent> => {
    const componentNormals = Object.values(normalForm).filter((item) => (isNormalComponent(item))) as NormalComponent[]
    const normalizer = new Normalizer()
    normalizer.loadNormal(normalForm)

    const roomReturns = componentNormals
        .map((component) => {
            const name = normalizer.select({ key: component.key, selector: selectName })
            const render = normalizer.select({ key: component.key, selector: selectRender })
            return { [component.key]: {
                tag: component.tag,
                name,
                render
            }}
        })
    
    return Object.assign({}, ...roomReturns)
}

export const LibraryAsset: FunctionComponent<LibraryAssetProps> = ({ assetKey, children, character }) => {

    const AssetId = useMemo<EphemeraCharacterId | EphemeraAssetId>(() => (`${character ? 'CHARACTER' : 'ASSET'}#${assetKey}`), [character, assetKey])
    const currentWML = useSelector(getCurrentWML(AssetId))
    const draftWML = useSelector(getDraftWML(AssetId))
    const normalForm = useSelector(getNormalized(AssetId))
    const schema = useSelector(getSchema(AssetId))
    const baseSchema = useSelector(getBaseSchema(AssetId))
    const standardForm = useSelector(getStandardForm(AssetId))
    const inheritedStandardForm = useSelector(getInherited(AssetId))
    const combinedStandardForm = useMemo((): StandardForm => {
        const standardizer = new Standardizer()
        standardizer.loadStandardForm(standardForm)
        const inheritedStandardizer = new Standardizer()
        inheritedStandardizer.loadStandardForm(inheritedStandardForm)
        return inheritedStandardizer.merge(standardizer).standardForm
    }, [standardForm, inheritedStandardForm])
    const loadedImages = useSelector(getLoadedImages(AssetId))
    const properties = useSelector(getProperties(AssetId))
    const status = useSelector(getStatus(AssetId))
    const serialized = useSelector(getSerialized(AssetId))
    const dispatch = useDispatch()
    const normalizer = useMemo(() => {
        const normalizer = new Normalizer()
        normalizer.loadNormal(normalForm)
        return normalizer
    }, [normalForm])
    const isKeyedCallback = <T extends {}>(args: { key?: string, selector (tree: GenericTree<SchemaTag, TreeId>, options?: {tag: string; key: string }): T }): args is { key: string, selector (tree: GenericTree<SchemaTag, TreeId>, options?: {tag: string; key: string }): T } => (typeof args.key !== 'undefined')
    const select = useCallback(<T extends {}>(args: { key?: string, selector: (tree: GenericTree<SchemaTag, TreeId>, options?: { tag: string; key: string }) => T }): T => (isKeyedCallback(args) ? normalizer.select(args) : args.selector(schema)), [normalizer, schema])
    const updateSchema = useCallback((updateAction: UpdateSchemaPayload) => {
        dispatch(updateSchemaAction(AssetId)(updateAction))
        dispatch(setIntent({ key: AssetId, intent: ['SCHEMADIRTY'] }))
        dispatch(heartbeat)
    }, [dispatch, AssetId])
    const components = useMemo<Record<string, AssetComponent>>(() => ( assetComponents({ normalForm }) ), [normalForm])
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
            select,
            schema,
            baseSchema,
            standardForm,
            combinedStandardForm,
            inheritedStandardForm,
            updateSchema,
            properties,
            loadedImages,
            components,
            rooms,
            exits,
            features,
            save,
            readonly: !(assetKey === 'draft'),
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
