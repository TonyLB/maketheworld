import React, { FunctionComponent, useEffect, useMemo, useCallback } from 'react'
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
import { NormalAsset, NormalRoom, NormalMap, NormalFeature, NormalImage, isNormalImage } from '@tonylb/mtw-wml/dist/normalize/baseClasses'

import WMLEdit from './WMLEdit'
import WMLComponentHeader from './WMLComponentHeader'
import MapHeader from './MapHeader'
import WMLComponentDetail from './WMLComponentDetail'
import AddWMLComponent from './AddWMLComponent'
import MapEdit from '../../Maps/Edit'
import LibraryBanner from './LibraryBanner'
import LibraryAsset, { useLibraryAsset } from './LibraryAsset'
import ImageHeader from './ImageHeader'

type AssetEditFormProps = {}

const AssetEditForm: FunctionComponent<AssetEditFormProps> = () => {
    const { normalForm, wmlQuery, updateWML, save } = useLibraryAsset()
    const navigate = useNavigate()

    const rooms = useMemo<NormalRoom[]>(() => (Object.values(normalForm || {}).filter(({ tag }) => (tag === 'Room')) as NormalRoom[]), [normalForm])
    const features = useMemo<NormalFeature[]>(() => (Object.values(normalForm || {}).filter(({ tag }) => (tag === 'Feature')) as NormalFeature[]), [normalForm])
    const maps = useMemo<NormalMap[]>(() => (Object.values(normalForm || {}).filter(({ tag }) => (tag === 'Map')) as NormalMap[]), [normalForm])
    const images = useMemo<NormalImage[]>(() => (Object.values(normalForm || {}).filter(isNormalImage)), [normalForm])
    const asset = Object.values(normalForm || {}).find(({ tag }) => (['Asset', 'Story'].includes(tag))) as NormalAsset | undefined
    const addAsset = useCallback((tag: string) => (componentId: string) => {
        wmlQuery.search('Asset, Story').addElement(`<${tag} key=(${componentId}) />`, { position: 'after' })
        updateWML(wmlQuery.source)
    }, [wmlQuery])
    return <Box sx={{ display: 'flex', flexDirection: 'column', width: "100%", height: "100%" }}>
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
        <Box sx={{ display: 'flex', marginLeft: '20px', overflowY: 'auto', flexGrow: 1 }}>
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
                <ListSubheader>Rooms</ListSubheader>
                { rooms.length
                    ? rooms.map((room) => (<WMLComponentHeader
                            key={room.key}
                            ItemId={room.key}
                            onClick={() => { navigate(`Room/${room.key}`)}}
                        />))
                    : null
                }
                <AddWMLComponent type="Room" onAdd={addAsset('Room')} />
                <ListSubheader>Features</ListSubheader>
                { features.length
                    ? features.map((feature) => (<WMLComponentHeader
                            key={feature.key}
                            ItemId={feature.key}
                            onClick={() => { navigate(`Feature/${feature.key}`)}}
                        />))
                    : null
                }
                <AddWMLComponent type="Feature" onAdd={addAsset('Feature')} />
                <ListSubheader>Images</ListSubheader>
                { images.length
                    ? images.map((image) => (<ImageHeader
                            key={image.key}
                            ItemId={image.key}
                            onClick={() => {}}
                        />))
                    : null
                }
                <AddWMLComponent type="Image" onAdd={addAsset('Image')} />
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

    return (['FRESH', 'WMLDIRTY', 'SCHEMADIRTY'].includes(currentStatus || '') && wmlQuery)
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
