import React, { FunctionComponent, useEffect, useMemo } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import {
    Box,
    CircularProgress,
    IconButton,
    List,
    ListItemButton,
    ListItemText,
    ListItemIcon,
    ListSubheader
} from '@mui/material'
import TextSnippetIcon from '@mui/icons-material/TextSnippet'
import {
    Routes,
    Route,
    useParams,
    useNavigate
} from "react-router-dom"

import useAutoPin from '../../../slices/UI/navigationTabs/useAutoPin'
import {
    addItem,
    getStatus,
    getCurrentWML,
    getNormalized,
    getWMLQuery,
    setCurrentWML
} from '../../../slices/personalAssets'
import { heartbeat } from '../../../slices/stateSeekingMachine/ssmHeartbeat'
import { NormalAsset, NormalRoom } from '../../../wml/normalize'

import WMLEdit from './WMLEdit'
import RoomHeader from './RoomHeader'

type AssetEditFormProps = {
    AssetId: string;
    assetKey: string;
}

const AssetEditForm: FunctionComponent<AssetEditFormProps> = ({ AssetId, assetKey }) => {
    const currentWML = useSelector(getCurrentWML(`ASSET#${AssetId}`))
    const normalForm = useSelector(getNormalized(`ASSET#${AssetId}`))
    const navigate = useNavigate()

    const rooms = useMemo<NormalRoom[]>(() => (Object.values(normalForm).filter(({ tag }) => (tag === 'Room')) as NormalRoom[]), [normalForm])
    const asset = Object.values(normalForm).find(({ tag }) => (['Asset', 'Story'].includes(tag))) as NormalAsset
    return <div>
        <div>
            { asset?.Story ? 'Story' : 'Asset' }: { asset?.key }
            <IconButton onClick={() => { navigate(`/Library/Edit/Asset/${assetKey}/WML`) }}>
                <TextSnippetIcon />
            </IconButton>
        </div>
        <Box sx={{ marginLeft: '20px' }}>
            <List>
                <ListSubheader>Rooms</ListSubheader>
                { rooms.map((room) => (<RoomHeader room={room} />))}
            </List>
        </Box>
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
    const currentWML = useSelector(getCurrentWML(AssetId))
    const wmlQuery = useSelector(getWMLQuery(AssetId))

    return (['FRESH', 'DIRTY'].includes(currentStatus || '') && wmlQuery)
        ? 
            <Routes>
                <Route path={'WML'} element={<WMLEdit currentWML={currentWML} AssetId={AssetId} updateWML={ (value) => { dispatch(setCurrentWML(AssetId)({ value })) }} />} />
                <Route path={''} element={<AssetEditForm AssetId={assetKey || ''} assetKey={assetKey || ''} />} />
            </Routes>
            
        : <div style={{ height: "100%", width: "100%", display: "flex", alignItems: "center", justifyContent: "center" }}><div><CircularProgress /></div></div>

}

export default EditAsset
