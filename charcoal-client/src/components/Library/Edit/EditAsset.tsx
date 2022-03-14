import React, { FunctionComponent, useEffect } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import CircularProgress from '@mui/material/CircularProgress'

import {
    useParams
} from "react-router-dom"

import useAutoPin from '../../../slices/UI/navigationTabs/useAutoPin'
import { addItem, getStatus, getCurrentWML } from '../../../slices/personalAssets'
import { heartbeat } from '../../../slices/stateSeekingMachine/ssmHeartbeat'

type AssetEditFormProps = {
    AssetId: string;
}

const AssetEditForm: FunctionComponent<AssetEditFormProps> = ({ AssetId }) => {
    const currentWML = useSelector(getCurrentWML(`ASSET#${AssetId}`))
    return <div>
        { currentWML }
    </div>
}

type EditAssetProps = {}

export const EditAsset: FunctionComponent<EditAssetProps> = () => {

    const { AssetId } = useParams<{ AssetId: string }>()
    useAutoPin({
        href: `/Library/Edit/Asset/${AssetId}`,
        label: `${AssetId}`
    })
    const dispatch = useDispatch()
    useEffect(() => {
        if (AssetId) {
            dispatch(addItem(`ASSET#${AssetId}`))
            dispatch(heartbeat)
        }
    }, [dispatch, AssetId])

    const currentStatus = useSelector(getStatus(`ASSET#${AssetId}` || 'none'))

    return (['FRESH', 'DIRTY'].includes(currentStatus || ''))
        ? <AssetEditForm AssetId={AssetId || ''} />
        : <div style={{ height: "100%", width: "100%", display: "flex", alignItems: "center", justifyContent: "center" }}><div><CircularProgress /></div></div>

}

export default EditAsset
