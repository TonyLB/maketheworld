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
import { useSelector } from 'react-redux'

type LibraryAssetContextType = {
    assetKey: string;
    AssetId: string;
}

const LibraryAssetContext = React.createContext<LibraryAssetContextType>({
    assetKey: '',
    AssetId: ''
})

type LibraryAssetProps = {
    assetKey: string;
    children?: ReactChild | ReactChildren;
}

export const LibraryAsset: FunctionComponent<LibraryAssetProps> = ({ assetKey, children }) => {

    const AssetId = `ASSET#${assetKey}`
    return (
        <LibraryAssetContext.Provider value={{
            assetKey,
            AssetId,
        }}>
            {children}
        </LibraryAssetContext.Provider>
    )
}

export const useLibraryAsset = () => (useContext(LibraryAssetContext))

export default LibraryAsset
