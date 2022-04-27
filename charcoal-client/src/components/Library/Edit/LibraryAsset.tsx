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
    getNormalized,
    getWMLQuery,
    getDefaultAppearances,
    setCurrentWML,
    setIntent
} from '../../../slices/personalAssets'
import { heartbeat } from '../../../slices/stateSeekingMachine/ssmHeartbeat'
import { WMLQuery } from '../../../wml/wmlQuery'
import { NormalForm, NormalRoom, NormalFeature, RoomAppearance, RoomRenderItem } from '../../../wml/normalize'

type LibraryAssetContextType = {
    assetKey: string;
    AssetId: string;
    currentWML: string;
    normalForm: NormalForm;
    defaultAppearances: Record<string, RoomAppearance>;
    wmlQuery: WMLQuery;
    updateWML: (value: string) => void;
    rooms: Record<string, AssetRoom>;
    features: Record<string, AssetFeature>;
    save: () => void;
}

const LibraryAssetContext = React.createContext<LibraryAssetContextType>({
    assetKey: '',
    AssetId: '',
    currentWML: '',
    normalForm: {},
    defaultAppearances: {},
    wmlQuery: new WMLQuery(''),
    updateWML: () => {},
    rooms: {},
    features: {},
    save: () => {}
})

type LibraryAssetProps = {
    assetKey: string;
    children?: ReactChild | ReactChildren;
}

export type AssetRoom = {
    localName: string;
    localRender: RoomRenderItem[];
    defaultName: string;
    defaultRender?: RoomRenderItem[];
    name: string;
    render: RoomRenderItem[];
    spaceBefore?: boolean;
    spaceAfter?: boolean;
}

export type AssetFeature = {
    localName: string;
    localRender: RoomRenderItem[];
    defaultName: string;
    defaultRender?: RoomRenderItem[];
    name: string;
    render: RoomRenderItem[];
    spaceBefore?: boolean;
    spaceAfter?: boolean;
}

const assetComponents = (tag: 'Room' | 'Feature') => ({ normalForm, defaultAppearances }: { normalForm: NormalForm, defaultAppearances: Record<string, RoomAppearance> }): Record<string, AssetRoom> => {
    const componentNormals = Object.values(normalForm)
        .filter(({ tag: checkTag }) => (checkTag === tag)) as (NormalRoom | NormalFeature)[]

    const roomReturns = componentNormals
        .map((component) => {
            const localName = (component.appearances
                .filter(({ contextStack }) => (!contextStack.find(({ tag }) => (tag === 'Condition'))))
                .map(({ name = '' }) => name)
                .join('')) || ''
            const countRenderAppearances = component.appearances
                .filter(({ contextStack }) => (!contextStack.find(({ tag }) => (tag === 'Condition'))))
                .length
            const localRender = component.appearances
                .filter(({ contextStack }) => (!contextStack.find(({ tag }) => (tag === 'Condition'))))
                .map(({ render = [] }) => render)
                .reduce((previous, render) => ([ ...previous, ...render ]), [])
            const spaceBefore = countRenderAppearances
                ? component.appearances
                    .filter(({ contextStack }) => (!contextStack.find(({ tag }) => (tag === 'Condition'))))
                    .map(({ spaceBefore = false }) => spaceBefore)
                    .reduce((previous, spaceBefore) => (previous || spaceBefore), false)
                : undefined
            const spaceAfter = countRenderAppearances
                ? component.appearances
                    .filter(({ contextStack }) => (!contextStack.find(({ tag }) => (tag === 'Condition'))))
                    .map(({ spaceAfter = false }) => spaceAfter)
                    .reduce((previous, spaceAfter) => (previous || spaceAfter), false)
                : undefined
            const defaultName = defaultAppearances[component.key]?.name || ''
            const defaultRender = defaultAppearances[component.key]?.render
            return { [component.key]: {
                localName,
                localRender,
                defaultName,
                defaultRender,
                spaceBefore,
                spaceAfter,
                name: `${defaultName}${localName}`,
                render: [...(defaultRender || []), ...localRender]
            }}
        })
    
    return Object.assign({}, ...roomReturns)
}

export const LibraryAsset: FunctionComponent<LibraryAssetProps> = ({ assetKey, children }) => {

    const AssetId = `ASSET#${assetKey}`
    const currentWML = useSelector(getCurrentWML(AssetId))
    const normalForm = useSelector(getNormalized(AssetId))
    const wmlQuery = useSelector(getWMLQuery(AssetId))
    const defaultAppearances = useSelector(getDefaultAppearances(AssetId))
    const dispatch = useDispatch()
    const updateWML = (value: string) => {
        const wmlQuery = new WMLQuery(value)
        const prettyPrinted = wmlQuery.prettyPrint().source
        dispatch(setCurrentWML(AssetId)({ value: prettyPrinted }))
    }
    const rooms = useMemo<Record<string, AssetRoom>>(() => ( assetComponents('Room')({ normalForm, defaultAppearances }) ), [normalForm, defaultAppearances])
    const features = useMemo<Record<string, AssetFeature>>(() => ( assetComponents('Feature')({ normalForm, defaultAppearances }) ), [normalForm, defaultAppearances])
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
            defaultAppearances,
            wmlQuery,
            updateWML,
            rooms,
            features,
            save
        }}>
            {children}
        </LibraryAssetContext.Provider>
    )
}

export const useLibraryAsset = () => (useContext(LibraryAssetContext))

export default LibraryAsset
