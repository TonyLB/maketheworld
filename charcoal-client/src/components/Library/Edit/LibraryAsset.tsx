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

import React, { useContext, ReactChild, ReactChildren, FunctionComponent, useMemo, useCallback } from 'react'
import { useSelector, useDispatch } from 'react-redux'

import {
    getCurrentWML,
    getImportDefaults,
    getNormalized,
    getWMLQuery,
    setCurrentWML,
    setIntent
} from '../../../slices/personalAssets'
import { heartbeat } from '../../../slices/stateSeekingMachine/ssmHeartbeat'
import { WMLQuery } from '@tonylb/mtw-wml/dist/wmlQuery'
import { NormalForm, NormalComponent, ComponentRenderItem, NormalExit, isNormalExit, isNormalComponent } from '@tonylb/mtw-wml/dist/normalize/baseClasses'
import { objectFilter } from '../../../lib/objects'
import { AssetClientImportDefaults } from '@tonylb/mtw-interfaces/dist/asset'

type LibraryAssetContextType = {
    assetKey: string;
    AssetId: string;
    currentWML: string;
    normalForm: NormalForm;
    importDefaults: AssetClientImportDefaults["defaultsByKey"];
    wmlQuery: WMLQuery;
    updateWML: (value: string, options?: { prettyPrint?: boolean }) => void;
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
    normalForm: {},
    importDefaults: {},
    wmlQuery: new WMLQuery(''),
    updateWML: () => {},
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
                .filter(({ contextStack }) => (!contextStack.find(({ tag }) => (tag === 'Condition'))))
                .map(({ name = [] }) => name)
                .reduce((previous, name) => ([ ...previous, ...name ]), [])
                .map((item) => ((item.tag === 'String') ? item.value : ''))
                .join('')) || ''
            const countRenderAppearances = component.appearances
                .filter(({ contextStack }) => (!contextStack.find(({ tag }) => (tag === 'Condition'))))
                .length
            const localRender = component.appearances
                .filter(({ contextStack }) => (!contextStack.find(({ tag }) => (tag === 'Condition'))))
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

    const AssetId = `${character ? 'CHARACTER' : 'ASSET'}#${assetKey}`
    const currentWML = useSelector(getCurrentWML(AssetId))
    const normalForm = useSelector(getNormalized(AssetId))
    const wmlQuery = useSelector(getWMLQuery(AssetId))
    const importDefaults = useSelector(getImportDefaults(AssetId))
    const dispatch = useDispatch()
    const updateWML = (value: string, options?: { prettyPrint?: boolean }) => {
        const { prettyPrint = true } = options || {}
        if (prettyPrint) {
            const wmlQuery = new WMLQuery(value)
            const prettyPrinted = wmlQuery.prettyPrint().source
            dispatch(setCurrentWML(AssetId)({ value: prettyPrinted }))
        }
        else {
            dispatch(setCurrentWML(AssetId)({ value }))
        }
    }
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
            normalForm,
            importDefaults,
            wmlQuery,
            updateWML,
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

export default LibraryAsset
