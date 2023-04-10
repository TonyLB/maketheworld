import React, { FunctionComponent, useEffect, useMemo, useCallback } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import {
    Box,
    CircularProgress,
    IconButton,
    List,
    ListSubheader,
    Button
} from '@mui/material'
import TextSnippetIcon from '@mui/icons-material/TextSnippet'
import SaveIcon from '@mui/icons-material/Save'
import {
    Routes,
    Route,
    useParams,
    useNavigate
} from "react-router-dom"

import useAutoPin from '../../../slices/UI/navigationTabs/useAutoPin'
import {
    addItem,
    getStatus
} from '../../../slices/personalAssets'
import { heartbeat } from '../../../slices/stateSeekingMachine/ssmHeartbeat'
import { NormalAsset, NormalRoom, NormalMap, NormalFeature, NormalImage, isNormalImage, NormalItem, isNormalVariable, NormalVariable, NormalComputed, isNormalComputed } from '@tonylb/mtw-wml/dist/normalize/baseClasses'

import WMLEdit from './WMLEdit'
import WMLComponentHeader from './WMLComponentHeader'
import MapHeader from './MapHeader'
import WMLComponentDetail from './WMLComponentDetail'
import AddWMLComponent from './AddWMLComponent'
import MapEdit from '../../Maps/Edit'
import LibraryBanner from './LibraryBanner'
import LibraryAsset, { useLibraryAsset } from './LibraryAsset'
import ImageHeader from './ImageHeader'
import { SchemaTag } from '@tonylb/mtw-wml/dist/schema/baseClasses'
import DraftLockout from './DraftLockout'
import JSHeader from './JSHeader'
import { extractDependenciesFromJS } from '@tonylb/mtw-wml/dist/convert/utils'

type AssetEditFormProps = {}

const defaultItemFromTag = (tag: 'Room' | 'Feature' | 'Image' | 'Variable' | 'Computed', key: string): SchemaTag => {
    switch(tag) {
        case 'Room':
            return {
                tag: 'Room' as const,
                key,
                contents: [],
                name: [],
                render: []
            }
        case 'Feature':
            return {
                tag: 'Feature' as const,
                key,
                contents: [],
                name: [],
                render: []
            }
        case 'Image':
            return {
                tag: 'Image' as const,
                key
            }
        case 'Variable':
            return {
                tag: 'Variable' as const,
                key,
                default: 'false'
            }
        case 'Computed':
            return {
                tag: 'Computed' as const,
                key,
                src: '',
                dependencies: []
            }
    }
}

const AssetEditForm: FunctionComponent<AssetEditFormProps> = () => {
    const { normalForm, updateNormal, save, AssetId, status } = useLibraryAsset()
    const navigate = useNavigate()

    const rooms = useMemo<NormalRoom[]>(() => (Object.values(normalForm || {}).filter(({ tag }) => (tag === 'Room')) as NormalRoom[]), [normalForm])
    const features = useMemo<NormalFeature[]>(() => (Object.values(normalForm || {}).filter(({ tag }) => (tag === 'Feature')) as NormalFeature[]), [normalForm])
    const maps = useMemo<NormalMap[]>(() => (Object.values(normalForm || {}).filter(({ tag }) => (tag === 'Map')) as NormalMap[]), [normalForm])
    const images = useMemo<NormalImage[]>(() => (Object.values(normalForm || {}).filter(isNormalImage)), [normalForm])
    const variables = useMemo<NormalVariable[]>(() => (Object.values(normalForm || {}).filter(isNormalVariable)), [normalForm])
    const computes = useMemo<NormalComputed[]>(() => (Object.values(normalForm || {}).filter(isNormalComputed)), [normalForm])
    const asset = Object.values(normalForm || {}).find(({ tag }) => (['Asset', 'Story'].includes(tag))) as NormalAsset | undefined
    const addAsset = useCallback((tag: 'Room' | 'Feature' | 'Image' | 'Variable' | 'Computed') => (componentId: string) => {
        const rootItem = Object.values(normalForm)
            .find(({ appearances = [] }) => (appearances.find(({ contextStack }) => (contextStack.length === 0))))
        if (rootItem) {
            updateNormal({
                type: 'put',
                item: defaultItemFromTag(tag, componentId),
                position: { contextStack: [{ key: rootItem.key, tag: rootItem.tag, index: 0 }]}
            })
        }
    }, [updateNormal, normalForm])
    return <Box sx={{ position: "relative", display: 'flex', flexDirection: 'column', width: "100%", height: "100%" }}>
        <LibraryBanner
            primary={asset?.key || 'Untitled'}
            secondary={asset?.Story ? 'Story' : 'Asset'}
            commands={
                <React.Fragment>
                    <Button onClick={save} disabled={status === 'FRESH'}><SaveIcon />Save</Button>
                    <IconButton onClick={() => { navigate(`WML`) }}>
                        <TextSnippetIcon />
                    </IconButton>
                </React.Fragment>
            }
            breadCrumbProps={[{
                    href: '/Library',
                    label: 'Library'
                },
                {
                    label: asset?.key || 'Untitled'
            }]}
        />
        <Box sx={{ display: 'flex', position: "relative", width: "100%", flexGrow: 1, overflowY: "auto" }}>
            <Box sx={{ marginLeft: "20px", width: "calc(100% - 20px)" }}>
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
                    <ListSubheader>Variables</ListSubheader>
                    { (variables || []).map((variable) => (<JSHeader
                            key={variable.key}
                            item={variable}
                            typeGuard={isNormalVariable}
                            getJS={(item) => (item.default)}
                            schema={(key, value) => ({
                                key,
                                tag: 'Variable',
                                default: value
                            })}
                            onClick={() => {}}
                            maxHeight="4em"
                        />))
                    }
                    <AddWMLComponent type="Variable" onAdd={addAsset('Variable')} />
                    <ListSubheader>Computes</ListSubheader>
                    { (computes || []).map((compute) => (<JSHeader
                            key={compute.key}
                            item={compute}
                            typeGuard={isNormalComputed}
                            getJS={(item) => (item.src)}
                            schema={(key, value) => ({
                                key,
                                tag: 'Computed',
                                src: value,
                                dependencies: extractDependenciesFromJS(value)
                            })}
                            onClick={() => {}}
                            maxHeight="8em"
                        />))
                    }
                    <AddWMLComponent type="Computed" onAdd={addAsset('Computed')} />
                </List>
            </Box>
            <DraftLockout />
        </Box>
    </Box>
}

type EditAssetProps = {}

export const EditAsset: FunctionComponent<EditAssetProps> = () => {

    const { AssetId: assetKey } = useParams<{ AssetId: string }>()
    const AssetId = `ASSET#${assetKey}` as const
    useAutoPin({
        href: `/Library/Edit/Asset/${assetKey}`,
        label: `${assetKey}`,
        type: 'LibraryEdit',
        iconName: 'Asset',
        assetId: AssetId,
        cascadingClose: true
    })
    const dispatch = useDispatch()
    useEffect(() => {
        if (assetKey) {
            dispatch(addItem({ key: `ASSET#${assetKey}` }))
            dispatch(heartbeat)
        }
    }, [dispatch, assetKey])

    const currentStatus = useSelector(getStatus(AssetId))

    return (['FRESH', 'WMLDIRTY', 'NORMALDIRTY', 'NEEDERROR', 'DRAFTERROR', 'NEEDPARSE', 'PARSEDRAFT'].includes(currentStatus || ''))
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
