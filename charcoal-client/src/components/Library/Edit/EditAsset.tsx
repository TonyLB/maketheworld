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
    ListSubheader,
    Button
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
    getWMLQuery
} from '../../../slices/personalAssets'
import { heartbeat } from '../../../slices/stateSeekingMachine/ssmHeartbeat'
import { NormalAsset, NormalRoom, NormalMap, NormalFeature } from '../../../wml/normalize'

import WMLEdit from './WMLEdit'
import WMLComponentHeader from './WMLComponentHeader'
import MapHeader from './MapHeader'
import WMLComponentDetail from './WMLComponentDetail'
import MapEdit from '../../Maps/Edit'
import LibraryBanner from './LibraryBanner'
import LibraryAsset, { useLibraryAsset } from './LibraryAsset'

type AssetEditFormProps = {}

const AssetEditForm: FunctionComponent<AssetEditFormProps> = () => {
    const { assetKey, normalForm, save } = useLibraryAsset()
    const navigate = useNavigate()

    const rooms = useMemo<NormalRoom[]>(() => (Object.values(normalForm || {}).filter(({ tag }) => (tag === 'Room')) as NormalRoom[]), [normalForm])
    const features = useMemo<NormalFeature[]>(() => (Object.values(normalForm || {}).filter(({ tag }) => (tag === 'Feature')) as NormalFeature[]), [normalForm])
    const maps = useMemo<NormalMap[]>(() => (Object.values(normalForm || {}).filter(({ tag }) => (tag === 'Map')) as NormalMap[]), [normalForm])
    const asset = Object.values(normalForm || {}).find(({ tag }) => (['Asset', 'Story'].includes(tag))) as NormalAsset | undefined
    return <Box sx={{ width: "100%" }}>
        <LibraryBanner
            primary={asset?.key || 'Untitled'}
            secondary={asset?.Story ? 'Story' : 'Asset'}
            commands={
                <IconButton onClick={() => { navigate(`WML`) }}>
                    <TextSnippetIcon />
                </IconButton>
            }
            breadCrumbProps={[{
                    href: '/Library',
                    label: 'Library'
                },
                {
                    label: asset?.key || 'Untitled'
            }]}
        />
        <Box sx={{ marginLeft: '20px' }}>
            <List>
                { maps.length
                    ? <React.Fragment>
                        <ListSubheader>Maps</ListSubheader>
                        { maps.map((mapItem) => (<MapHeader
                            key={mapItem.key}
                            mapItem={mapItem}
                            onClick={() => { navigate(`Map/${mapItem.key}`)}}
                        />))}
                    </React.Fragment>
                    : null
                }
                { rooms.length
                    ? <React.Fragment>
                        <ListSubheader>Rooms</ListSubheader>
                        { rooms.map((room) => (<WMLComponentHeader
                            key={room.key}
                            component={room}
                            AssetId={assetKey}
                            onClick={() => { navigate(`Room/${room.key}`)}}
                        />))}
                    </React.Fragment>
                    : null
                }
                { features.length
                    ? <React.Fragment>
                        <ListSubheader>Features</ListSubheader>
                        { features.map((feature) => (<WMLComponentHeader
                            key={feature.key}
                            component={feature}
                            AssetId={assetKey}
                            onClick={() => { navigate(`Feature/${feature.key}`)}}
                        />))}
                    </React.Fragment>
                    : null
                }
            </List>
        </Box>
        <Button onClick={save}>Save</Button>
    </Box>
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
            dispatch(addItem({ key: `ASSET#${assetKey}` }))
            dispatch(heartbeat)
        }
    }, [dispatch, assetKey])

    const currentStatus = useSelector(getStatus(AssetId))
    const wmlQuery = useSelector(getWMLQuery(AssetId))

    return (['FRESH', 'DIRTY'].includes(currentStatus || '') && wmlQuery)
        ? 
            <LibraryAsset assetKey={assetKey || ''}>
                <Routes>
                    <Route path={'WML'} element={<WMLEdit />} />
                    <Route path={'Map/:MapId'} element={<MapEdit />} />
                    <Route path={'Room/:ComponentId'} element={<WMLComponentDetail />} />
                    <Route path={'Feature/:ComponentId'} element={<WMLComponentDetail />} />
                    <Route path={''} element={<AssetEditForm />} />
                </Routes>
            </LibraryAsset>
            
        : <div style={{ height: "100%", width: "100%", display: "flex", alignItems: "center", justifyContent: "center" }}><div><CircularProgress /></div></div>

}

export default EditAsset
