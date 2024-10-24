import React, { FunctionComponent, useEffect, useMemo, useCallback, useState } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import {
    Box,
    CircularProgress,
    IconButton,
    List,
    ListSubheader,
    ListItemButton,
    ListItemIcon,
    ListItemText,
    Button,
    Dialog,
    DialogTitle,
    DialogContent,
    Typography,
    DialogActions
} from '@mui/material'

import FeatureIcon from '@mui/icons-material/Search'
import KnowledgeIcon from '@mui/icons-material/School'
import AddIcon from '@mui/icons-material/Add'
import ThemeIcon from '@mui/icons-material/TheaterComedy'

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

import WMLEdit from './WMLEdit'
import WMLComponentHeader from './WMLComponentHeader'
import MapHeader from './MapHeader'
import WMLComponentDetail from './WMLComponentDetail'
import MapEdit from '../../Maps/Edit'
import LibraryBanner from './LibraryBanner'
import LibraryAsset, { useLibraryAsset } from './LibraryAsset'
import ImageHeader from './ImageHeader'
import DraftLockout from './DraftLockout'
import JSHeader from './JSHeader'
import { addOnboardingComplete } from '../../../slices/player/index.api'
import ThemeEditor from './ThemeEditor'
import { StandardAction, StandardComputed, StandardFeature, StandardImage, StandardKnowledge, StandardMap, StandardRoom, StandardTheme, StandardVariable, isStandardAction, isStandardComputed, isStandardFeature, isStandardImage, isStandardKnowledge, isStandardMap, isStandardRoom, isStandardVariable } from '@tonylb/mtw-wml/dist/standardize/baseClasses'
import { isStandardTheme } from '@tonylb/mtw-wml/dist/standardize/baseClasses'
import { schemaOutputToString } from '@tonylb/mtw-wml/dist/schema/utils/schemaOutput/schemaOutputToString'
import { useOnboardingCheckpoint } from '../../Onboarding/useOnboarding'
import { ignoreWrapped } from '@tonylb/mtw-wml/dist/schema/utils'

type AssetEditFormProps = {}

// const defaultItemFromTag = (tag: 'Theme' | 'Map' | 'Room' | 'Feature' | 'Knowledge' | 'Image' | 'Variable' | 'Computed' | 'Action', key: string): SchemaTag => {
//     switch(tag) {
//         case 'Room':
//         case 'Feature':
//         case 'Knowledge':
//             return {
//                 tag,
//                 key
//             }
//         case 'Image':
//             return {
//                 tag: 'Image' as const,
//                 key
//             }
//         case 'Variable':
//             return {
//                 tag: 'Variable' as const,
//                 key,
//                 default: 'false'
//             }
//         case 'Computed':
//             return {
//                 tag: 'Computed' as const,
//                 key,
//                 src: ''
//             }
//         case 'Action':
//             return {
//                 tag: 'Action' as const,
//                 key,
//                 src: ''
//             }
//         case 'Map':
//             return {
//                 tag: 'Map' as const,
//                 key
//             }
//         case 'Theme':
//             return {
//                 tag: 'Theme' as const,
//                 key
//             }
//     }
// }

const AddWMLComponent: FunctionComponent<{ type: 'Theme' | 'Map' | 'Room' | 'Feature' | 'Knowledge' | 'Image' | 'Variable' | 'Computed' | 'Action'; onAdd: () => void }> = ({ type, onAdd }) => (
    <ListItemButton onClick={onAdd}>
        <ListItemIcon>
            <AddIcon />
        </ListItemIcon>
        <ListItemText primary={`Add ${type}`} />
    </ListItemButton>
)

const AssetEditForm: FunctionComponent<AssetEditFormProps> = () => {
    const { updateStandard, save, status, standardForm, readonly, assetKey } = useLibraryAsset()
    useOnboardingCheckpoint('navigateBackToDraft', { requireSequence: true, condition: assetKey === 'draft' })
    const navigate = useNavigate()

    //
    // TODO: Refactor below into a single reduce statement that updates a record of lists.
    //
    const themes = useMemo<StandardTheme[]>(() => (Object.values(standardForm?.byId || {}).filter(isStandardTheme)), [standardForm])
    const rooms = useMemo<StandardRoom[]>(() => (Object.values(standardForm?.byId || {}).filter(isStandardRoom)), [standardForm])
    const features = useMemo<StandardFeature[]>(() => (Object.values(standardForm?.byId || {}).filter(isStandardFeature)), [standardForm])
    const knowledges = useMemo<StandardKnowledge[]>(() => (Object.values(standardForm?.byId || {}).filter(isStandardKnowledge)), [standardForm])
    const maps = useMemo<StandardMap[]>(() => (Object.values(standardForm?.byId || {}).filter(isStandardMap)), [standardForm])
    const images = useMemo<StandardImage[]>(() => (Object.values(standardForm?.byId || {}).filter(isStandardImage)), [standardForm])
    const variables = useMemo<StandardVariable[]>(() => (Object.values(standardForm?.byId || {}).filter(isStandardVariable)), [standardForm])
    const computes = useMemo<StandardComputed[]>(() => (Object.values(standardForm?.byId || {}).filter(isStandardComputed)), [standardForm])
    const actions = useMemo<StandardAction[]>(() => (Object.values(standardForm?.byId || {}).filter(isStandardAction)), [standardForm])

    const dispatch = useDispatch()
    const addAsset = useCallback((tag: 'Theme' | 'Map' | 'Room' | 'Feature' | 'Knowledge' | 'Image' | 'Variable' | 'Computed' | 'Action') => () => {
        switch(tag) {
            case 'Room':
                dispatch(addOnboardingComplete(['addRoom']))
                break
        }
        updateStandard({
            type: 'addComponent',
            tag
        })
    }, [updateStandard, dispatch])
    return <Box sx={{ position: "relative", display: 'flex', flexDirection: 'column', width: "100%", height: "100%" }}>
        <LibraryBanner
            primary={standardForm.key || 'Untitled'}
            secondary={'Asset'}
            commands={
                <React.Fragment>
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
                    label: standardForm.key || 'Untitled'
            }]}
        />
        <Box sx={{ display: 'flex', position: "relative", width: "100%", flexGrow: 1, overflowY: "auto" }}>
            <Box sx={{ marginLeft: "20px", width: "calc(100% - 20px)" }}>
                <List>
                    <ListSubheader>Themes</ListSubheader>
                    { themes.length
                        ? <React.Fragment>
                            { themes.map((themeItem) => (
                                <ListItemButton key={themeItem.key} onClick={() => { navigate(`Theme/${themeItem.key}`)}}>
                                    <ListItemIcon>
                                        <ThemeIcon />
                                    </ListItemIcon>
                                    <ListItemText primary={schemaOutputToString(ignoreWrapped(themeItem.name)?.children ?? []) || 'Untitled'} secondary={themeItem.key} />
                                </ListItemButton>
                            ))}
                        </React.Fragment>
                        : null
                    }
                    { !readonly && <AddWMLComponent type="Theme" onAdd={addAsset('Theme')} /> }
                    <ListSubheader>Maps</ListSubheader>
                    { maps.length
                        ? <React.Fragment>
                            { maps.map((mapItem) => (<MapHeader
                                key={mapItem.key}
                                itemId={mapItem.key}
                                onClick={() => { navigate(`Map/${mapItem.key}`)}}
                            />))}
                        </React.Fragment>
                        : null
                    }
                    { !readonly && <AddWMLComponent type="Map" onAdd={addAsset('Map')} /> }
                    <ListSubheader>Rooms</ListSubheader>
                    { rooms.length
                        ? rooms.map((room) => (<WMLComponentHeader
                                key={room.key}
                                ItemId={room.key}
                                onClick={() => { navigate(`Room/${room.key}`)}}
                            />))
                        : null
                    }
                    { !readonly && <AddWMLComponent type="Room" onAdd={addAsset('Room')} /> }
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
                    { !readonly && <AddWMLComponent type="Feature" onAdd={addAsset('Feature')} /> }
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
                    { !readonly && <AddWMLComponent type="Knowledge" onAdd={addAsset('Knowledge')} /> }
                    <ListSubheader>Images</ListSubheader>
                    { images.length
                        ? images.map((image) => (<ImageHeader
                                key={image.key}
                                ItemId={image.key}
                                onClick={() => {}}
                            />))
                        : null
                    }
                    { !readonly && <AddWMLComponent type="Image" onAdd={addAsset('Image')} /> }
                    <ListSubheader>Variables</ListSubheader>
                    { (variables || [])
                        .map((variable) => (<JSHeader
                            key={variable.key}
                            item={variable}
                            getJS={(item) => (item.default)}
                            maxHeight="4em"
                        />))
                    }
                    { !readonly && <AddWMLComponent type="Variable" onAdd={addAsset('Variable')} /> }
                    <ListSubheader>Computes</ListSubheader>
                    { (computes || []).map((compute) => (<JSHeader
                            key={compute.key}
                            item={compute}
                            getJS={(item) => (item.src)}
                            maxHeight="8em"
                        />))
                    }
                    { !readonly && <AddWMLComponent type="Computed" onAdd={addAsset('Computed')} /> }
                    <ListSubheader>Actions</ListSubheader>
                    { (actions || []).map((action) => (<JSHeader
                            key={action.key}
                            item={action}
                            getJS={(item) => (item.src)}
                            maxHeight="32em"
                        />))
                    }
                    { !readonly && <AddWMLComponent type="Action" onAdd={addAsset('Action')} /> }
                </List>
            </Box>
            <DraftLockout />
        </Box>
    </Box>
}

type EditAssetProps = {}

export const EditAsset: FunctionComponent<EditAssetProps> = () => {

    const { AssetId: assetKey = 'draft' } = useParams<{ AssetId: string }>()
    const AssetId = `ASSET#${assetKey}` as const
    useAutoPin({
        href: assetKey === 'draft' ? '/Draft/' : `/Library/Edit/Asset/${assetKey}`,
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

    return <React.Fragment>
        {
            (['FRESH', 'WMLDIRTY', 'SCHEMADIRTY', 'NEEDERROR', 'DRAFTERROR', 'NEEDPARSE', 'PARSEDRAFT'].includes(currentStatus || ''))
                ? 
                    <LibraryAsset assetKey={assetKey || ''}>
                        <Routes>
                            <Route path={'WML'} element={<WMLEdit />} />
                            <Route path={'Map/:MapId'} element={<MapEdit />} />
                            <Route path={'Theme/:ComponentId'} element={<ThemeEditor />} />
                            <Route path={'Room/:ComponentId'} element={<WMLComponentDetail />} />
                            <Route path={'Feature/:ComponentId'} element={<WMLComponentDetail />} />
                            <Route path={'Knowledge/:ComponentId'} element={<WMLComponentDetail />} />
                            <Route path={''} element={<AssetEditForm />} />
                        </Routes>
                    </LibraryAsset>
                    
                : <div style={{ height: "100%", width: "100%", display: "flex", alignItems: "center", justifyContent: "center" }}><div><CircularProgress /></div></div>
        }
    </React.Fragment>

}

export default EditAsset
