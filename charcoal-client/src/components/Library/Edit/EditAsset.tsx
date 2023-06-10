import React, { FunctionComponent, useEffect, useMemo, useCallback, useState } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import {
    Box,
    CircularProgress,
    IconButton,
    List,
    ListSubheader,
    Button,
    Dialog,
    DialogTitle,
    DialogContent,
    Typography,
    DialogActions
} from '@mui/material'

import FeatureIcon from '@mui/icons-material/Search'
import KnowledgeIcon from '@mui/icons-material/School'

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
    assignAssetToCharacterId,
    getStatus
} from '../../../slices/personalAssets'
import { heartbeat } from '../../../slices/stateSeekingMachine/ssmHeartbeat'
import { NormalAsset, NormalRoom, NormalMap, NormalFeature, NormalImage, isNormalImage, NormalItem, isNormalVariable, NormalVariable, NormalComputed, isNormalComputed, NormalAction, isNormalAction, NormalKnowledge } from '@tonylb/mtw-wml/dist/normalize/baseClasses'

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
import { addOnboardingComplete } from '../../../slices/player/index.api'
import { getMyCharacters } from '../../../slices/player'
import { isEphemeraAssetId } from '@tonylb/mtw-interfaces/dist/baseClasses'

type AssetEditFormProps = {
    setAssignDialogShown: (value: boolean) => void;
}

const defaultItemFromTag = (tag: 'Room' | 'Feature' | 'Knowledge' | 'Image' | 'Variable' | 'Computed' | 'Action', key: string): SchemaTag => {
    switch(tag) {
        case 'Room':
        case 'Feature':
        case 'Knowledge':
            return {
                tag,
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
        case 'Action':
            return {
                tag: 'Action' as const,
                key,
                src: ''
            }
    }
}

type AssetAssignDialogProps = {
    open: boolean;
    onClose: () => void;
    assignHandler: () => void;
}

const AssetAssignDialog: FunctionComponent<AssetAssignDialogProps> = ({ open, onClose, assignHandler }) => {
    return <Dialog
            open={open}
            onClose={onClose}
        >
            <DialogTitle>Assign asset to characters?</DialogTitle>
            <DialogContent>
                <Typography>
                    Would you like to have all your characters able to see this asset?
                </Typography>
            </DialogContent>
            <DialogActions>
                <Button onClick={() => { onClose()}}>No</Button>
                <Button onClick={() => {
                    assignHandler()
                    onClose()
                }} autoFocus>Yes</Button>
            </DialogActions>
        </Dialog>
}

const AssetEditForm: FunctionComponent<AssetEditFormProps> = ({ setAssignDialogShown }) => {
    const { normalForm, updateNormal, save, status, serialized } = useLibraryAsset()
    const navigate = useNavigate()

    const rooms = useMemo<NormalRoom[]>(() => (Object.values(normalForm || {}).filter(({ tag }) => (tag === 'Room')) as NormalRoom[]), [normalForm])
    const features = useMemo<NormalFeature[]>(() => (Object.values(normalForm || {}).filter(({ tag }) => (tag === 'Feature')) as NormalFeature[]), [normalForm])
    const knowledges = useMemo<NormalKnowledge[]>(() => (Object.values(normalForm || {}).filter(({ tag }) => (tag === 'Knowledge')) as NormalKnowledge[]), [normalForm])
    const maps = useMemo<NormalMap[]>(() => (Object.values(normalForm || {}).filter(({ tag }) => (tag === 'Map')) as NormalMap[]), [normalForm])
    const images = useMemo<NormalImage[]>(() => (Object.values(normalForm || {}).filter(isNormalImage)), [normalForm])
    const variables = useMemo<NormalVariable[]>(() => (Object.values(normalForm || {}).filter(isNormalVariable)), [normalForm])
    const computes = useMemo<NormalComputed[]>(() => (Object.values(normalForm || {}).filter(isNormalComputed)), [normalForm])
    const actions = useMemo<NormalAction[]>(() => (Object.values(normalForm || {}).filter(isNormalAction)), [normalForm])
    const asset = Object.values(normalForm || {}).find(({ tag }) => (['Asset', 'Story'].includes(tag))) as NormalAsset | undefined
    const dispatch = useDispatch()
    const addAsset = useCallback((tag: 'Room' | 'Feature' | 'Knowledge' | 'Image' | 'Variable' | 'Computed' | 'Action') => (componentId: string) => {
        switch(tag) {
            case 'Room':
                dispatch(addOnboardingComplete(['addRoom']))
                break
        }
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
    const innerSaveHandler = useCallback(() => {
        dispatch(addOnboardingComplete(['saveAsset'], { requireSequence: true }))
        save()
    }, [save])
    const saveHandler = useCallback(() => {
        innerSaveHandler()
        if (!Boolean(serialized)) {
            setAssignDialogShown(true)
        }
    }, [innerSaveHandler, serialized, setAssignDialogShown])
    return <Box sx={{ position: "relative", display: 'flex', flexDirection: 'column', width: "100%", height: "100%" }}>
        <LibraryBanner
            primary={asset?.key || 'Untitled'}
            secondary={asset?.Story ? 'Story' : 'Asset'}
            commands={
                <React.Fragment>
                    <Button onClick={saveHandler} disabled={status === 'FRESH'}><SaveIcon />Save</Button>
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
                                icon={<FeatureIcon />}
                            />))
                        : null
                    }
                    <AddWMLComponent type="Feature" onAdd={addAsset('Feature')} />
                    <ListSubheader>Knowledge</ListSubheader>
                    { knowledges.length
                        ? knowledges.map((knowledge) => (<WMLComponentHeader
                                key={knowledge.key}
                                ItemId={knowledge.key}
                                onClick={() => { navigate(`Knowledge/${knowledge.key}`)}}
                                icon={<KnowledgeIcon />}
                            />))
                        : null
                    }
                    <AddWMLComponent type="Knowledge" onAdd={addAsset('Knowledge')} />
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
                    <ListSubheader>Actions</ListSubheader>
                    { (actions || []).map((action) => (<JSHeader
                            key={action.key}
                            item={action}
                            typeGuard={isNormalAction}
                            getJS={(item) => (item.src)}
                            schema={(key, value) => ({
                                key,
                                tag: 'Action',
                                src: value
                            })}
                            onClick={() => {}}
                            maxHeight="32em"
                        />))
                    }
                    <AddWMLComponent type="Action" onAdd={addAsset('Action')} />
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
    const [assignDialogShown, setAssignDialogShown] = useState<boolean>(false)
    const Characters = useSelector(getMyCharacters)
    const assignHandler = useCallback(() => {
        if (isEphemeraAssetId(AssetId)) {
            //
            // TODO: Figure out how to get DB-ID from Character, rather than namespace key, for this
            // assign
            //
            Characters.forEach(({ scopedId }) => {
                dispatch(assignAssetToCharacterId({ assetId: AssetId, characterId: `CHARACTER#${scopedId}` }))
            })
        }
    }, [AssetId, Characters])

    return <React.Fragment>
        <AssetAssignDialog open={assignDialogShown} onClose={() => { setAssignDialogShown(false) }} assignHandler={assignHandler} />
        {
            (['FRESH', 'WMLDIRTY', 'NORMALDIRTY', 'NEEDERROR', 'DRAFTERROR', 'NEEDPARSE', 'PARSEDRAFT'].includes(currentStatus || ''))
                ? 
                    <LibraryAsset assetKey={assetKey || ''}>
                        <Routes>
                            <Route path={'WML'} element={<WMLEdit />} />
                            <Route path={'Map/:MapId'} element={<MapEdit />} />
                            <Route path={'Room/:ComponentId'} element={<WMLComponentDetail />} />
                            <Route path={'Feature/:ComponentId'} element={<WMLComponentDetail />} />
                            <Route path={'Knowledge/:ComponentId'} element={<WMLComponentDetail />} />
                            <Route path={''} element={<AssetEditForm setAssignDialogShown={setAssignDialogShown} />} />
                        </Routes>
                    </LibraryAsset>
                    
                : <div style={{ height: "100%", width: "100%", display: "flex", alignItems: "center", justifyContent: "center" }}><div><CircularProgress /></div></div>
        }
    </React.Fragment>

}

export default EditAsset
