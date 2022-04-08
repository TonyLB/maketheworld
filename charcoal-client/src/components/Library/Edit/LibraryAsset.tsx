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
import { NormalForm, RoomAppearance, RoomRenderItem } from '../../../wml/normalize'

type LibraryAssetContextType = {
    assetKey: string;
    AssetId: string;
    currentWML: string;
    normalForm: NormalForm;
    defaultAppearances: Record<string, RoomAppearance>;
    wmlQuery: WMLQuery;
    updateWML: (value: string) => void;
    rooms: Record<string, AssetRoom>;
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
}

const assetRooms = ({ normalForm, defaultAppearances }: { normalForm: NormalForm, defaultAppearances: Record<string, RoomAppearance> }): Record<string, AssetRoom> => {
    const roomNormals = Object.values(normalForm)
        .filter(({ tag }) => (tag === 'Room'))

    const roomReturns = roomNormals
        .map((room) => {
            const localName = (room && room.tag === 'Room' && room.appearances
                .filter(({ contextStack }) => (!contextStack.find(({ tag }) => (tag === 'Condition'))))
                .map(({ name = '' }) => name)
                .join('')) || ''
            const localRender = (room && room.tag === 'Room' && room.appearances
                .filter(({ contextStack }) => (!contextStack.find(({ tag }) => (tag === 'Condition'))))
                .map(({ render = [] }) => render)
                .reduce((previous, render) => ([ ...previous, ...render ]), []))  || []
            const defaultName = defaultAppearances[room.key]?.name || ''
            const defaultRender = defaultAppearances[room.key]?.render
            return { [room.key]: {
                localName,
                localRender,
                defaultName,
                defaultRender,
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
    const updateWML = (value: string) => { dispatch(setCurrentWML(AssetId)({ value })) }
    const rooms = useMemo<Record<string, AssetRoom>>(() => ( assetRooms({ normalForm, defaultAppearances }) ), [normalForm, defaultAppearances])
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
            save
        }}>
            {children}
        </LibraryAssetContext.Provider>
    )
}

export const useLibraryAsset = () => (useContext(LibraryAssetContext))

export default LibraryAsset
