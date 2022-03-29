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

import React, { useContext, ReactChild, ReactChildren, FunctionComponent } from 'react'
import { useSelector, useDispatch } from 'react-redux'

import {
    addItem,
    getStatus,
    getCurrentWML,
    getNormalized,
    getWMLQuery,
    getDefaultAppearances,
    setCurrentWML
} from '../../../slices/personalAssets'
import { WMLQuery } from '../../../wml/wmlQuery'
import { NormalForm, RoomAppearance } from '../../../wml/normalize'

type LibraryAssetContextType = {
    assetKey: string;
    AssetId: string;
    currentWML: string;
    normalForm: NormalForm;
    defaultAppearances: Record<string, RoomAppearance>;
    wmlQuery: WMLQuery;
    updateWML: (value: string) => void;
}

const LibraryAssetContext = React.createContext<LibraryAssetContextType>({
    assetKey: '',
    AssetId: '',
    currentWML: '',
    normalForm: {},
    defaultAppearances: {},
    wmlQuery: new WMLQuery(''),
    updateWML: () => {}
})

type LibraryAssetProps = {
    assetKey: string;
    children?: ReactChild | ReactChildren;
}

export const LibraryAsset: FunctionComponent<LibraryAssetProps> = ({ assetKey, children }) => {

    const AssetId = `ASSET#${assetKey}`
    const currentWML = useSelector(getCurrentWML(AssetId))
    const normalForm = useSelector(getNormalized(AssetId))
    const wmlQuery = useSelector(getWMLQuery(AssetId))
    const defaultAppearances = useSelector(getDefaultAppearances(AssetId))
    const dispatch = useDispatch()
    const updateWML = (value: string) => { dispatch(setCurrentWML(AssetId)({ value })) }

    return (
        <LibraryAssetContext.Provider value={{
            assetKey,
            AssetId,
            currentWML,
            normalForm,
            defaultAppearances,
            wmlQuery,
            updateWML
        }}>
            {children}
        </LibraryAssetContext.Provider>
    )
}

export const useLibraryAsset = () => (useContext(LibraryAssetContext))

export default LibraryAsset
