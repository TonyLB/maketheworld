import React, { FunctionComponent, useEffect } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import CircularProgress from '@mui/material/CircularProgress'

import {
    useParams
} from "react-router-dom"

import useAutoPin from '../../../slices/UI/navigationTabs/useAutoPin'
import {
    addItem,
    getStatus,
    getCurrentWML,
    getNormalized
} from '../../../slices/personalAssets'
import { heartbeat } from '../../../slices/stateSeekingMachine/ssmHeartbeat'
import { NormalAsset } from '../../../wml/normalize'

type AssetEditFormProps = {
    AssetId: string;
}

const AssetEditForm: FunctionComponent<AssetEditFormProps> = ({ AssetId }) => {
    const currentWML = useSelector(getCurrentWML(`ASSET#${AssetId}`))
    const normalForm = useSelector(getNormalized(`ASSET#${AssetId}`))

    const asset = Object.values(normalForm).find(({ tag }) => (['Asset', 'Story'].includes(tag))) as NormalAsset
    return <div>
        <div>
            { asset?.Story ? 'Story' : 'Asset' }: { asset?.key }
        </div>
        <div>
            { currentWML }
        </div>
    </div>
}

type EditAssetProps = {}

export const EditAsset: FunctionComponent<EditAssetProps> = () => {

    const { AssetId: assetKey } = useParams<{ AssetId: string }>()
    const AssetId = `ASSET#${assetKey}`
    useAutoPin({
        href: `/Library/Edit/Asset/${assetKey}`,
        label: `${assetKey}`
    })
    const dispatch = useDispatch()
    useEffect(() => {
        if (assetKey) {
            dispatch(addItem(AssetId))
            dispatch(heartbeat)
        }
    }, [dispatch, assetKey])

    const currentStatus = useSelector(getStatus(AssetId))

    return (['FRESH', 'DIRTY'].includes(currentStatus || ''))
        ? <AssetEditForm AssetId={assetKey || ''} />
        : <div style={{ height: "100%", width: "100%", display: "flex", alignItems: "center", justifyContent: "center" }}><div><CircularProgress /></div></div>

}

export default EditAsset
