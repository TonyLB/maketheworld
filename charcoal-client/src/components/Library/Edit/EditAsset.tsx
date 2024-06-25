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
    assignAssetToCharacterId,
    getStatus
} from '../../../slices/personalAssets'
import { heartbeat } from '../../../slices/stateSeekingMachine/ssmHeartbeat'
import { NormalAsset, NormalRoom, NormalMap, NormalFeature, NormalImage, isNormalImage, isNormalVariable, NormalVariable, NormalComputed, isNormalComputed, NormalAction, isNormalAction, NormalKnowledge } from '@tonylb/mtw-wml/dist/normalize/baseClasses'

import WMLEdit from './WMLEdit'
import WMLComponentHeader from './WMLComponentHeader'
import MapHeader from './MapHeader'
import WMLComponentDetail from './WMLComponentDetail'
import MapEdit from '../../Maps/Edit'
import LibraryBanner from './LibraryBanner'
import LibraryAsset, { useLibraryAsset } from './LibraryAsset'
import ImageHeader from './ImageHeader'
import { SchemaActionTag, SchemaComputedTag, SchemaTag, SchemaVariableTag, isSchemaAction, isSchemaAsset, isSchemaComputed, isSchemaVariable, isSchemaWithKey } from '@tonylb/mtw-wml/dist/schema/baseClasses'
import DraftLockout from './DraftLockout'
import JSHeader from './JSHeader'
import { extractDependenciesFromJS } from '@tonylb/mtw-wml/dist/convert/utils'
import { addOnboardingComplete } from '../../../slices/player/index.api'
import { getMyCharacters } from '../../../slices/player'
import { isEphemeraAssetId } from '@tonylb/mtw-interfaces/dist/baseClasses'
import { TreeId } from '@tonylb/mtw-wml/dist/tree/baseClasses'
import { treeTypeGuardOnce } from '@tonylb/mtw-wml/dist/tree/filter'
import ThemeEditor from './ThemeEditor'
import { StandardFeature, StandardImage, StandardKnowledge, StandardMap, StandardRoom, StandardTheme, isStandardFeature, isStandardImage, isStandardKnowledge, isStandardMap, isStandardRoom } from '@tonylb/mtw-wml/dist/standardize/baseClasses'
import { isStandardTheme } from '@tonylb/mtw-wml/dist/standardize/baseClasses'
import { schemaOutputToString } from '@tonylb/mtw-wml/dist/schema/utils/schemaOutput/schemaOutputToString'

type AssetEditFormProps = {
    setAssignDialogShown: (value: boolean) => void;
}

const defaultItemFromTag = (tag: 'Theme' | 'Map' | 'Room' | 'Feature' | 'Knowledge' | 'Image' | 'Variable' | 'Computed' | 'Action', key: string): SchemaTag => {
    switch(tag) {
        case 'Room':
        case 'Feature':
        case 'Knowledge':
            return {
                tag,
                key
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
                src: ''
            }
        case 'Action':
            return {
                tag: 'Action' as const,
                key,
                src: ''
            }
        case 'Map':
            return {
                tag: 'Map' as const,
                key
            }
        case 'Theme':
            return {
                tag: 'Theme' as const,
                key
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

const AddWMLComponent: FunctionComponent<{ type: 'Theme' | 'Map' | 'Room' | 'Feature' | 'Knowledge' | 'Image' | 'Variable' | 'Computed' | 'Action'; onAdd: () => void }> = ({ type, onAdd }) => (
    <ListItemButton onClick={onAdd}>
        <ListItemIcon>
            <AddIcon />
        </ListItemIcon>
        <ListItemText primary={`Add ${type}`} />
    </ListItemButton>
)

const AssetEditForm: FunctionComponent<AssetEditFormProps> = ({ setAssignDialogShown }) => {
    const { schema, baseSchema, updateSchema, save, status, serialized, standardForm } = useLibraryAsset()
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
    const jsItems = useMemo(() => (
        treeTypeGuardOnce<SchemaTag, SchemaComputedTag | SchemaVariableTag | SchemaActionTag, TreeId>({ tree: baseSchema, typeGuard: (data: SchemaTag): data is SchemaComputedTag | SchemaVariableTag | SchemaActionTag => (['Action', 'Computed', 'Varaible'].includes(data.tag)) })
    ), [schema])
    //
    // Build variables, computes, and actions out of jsItems rather than Normal, and refactor JSHeader to accept GenericTreeNode<Schema??Tag, TreeId>
    // rather than NormalItem (temporarily, until TreeId can be folded into NormalForm)
    //
    const variables = useMemo(() => (treeTypeGuardOnce<SchemaTag, SchemaVariableTag, TreeId>({ tree: jsItems, typeGuard: isSchemaVariable })), [jsItems])
    const computes = useMemo(() => (treeTypeGuardOnce<SchemaTag, SchemaComputedTag, TreeId>({ tree: jsItems, typeGuard: isSchemaComputed })), [jsItems])
    const actions = useMemo(() => (treeTypeGuardOnce<SchemaTag, SchemaActionTag, TreeId>({ tree: jsItems, typeGuard: isSchemaAction })), [jsItems])
    const dispatch = useDispatch()
    const addAsset = useCallback((tag: 'Theme' | 'Map' | 'Room' | 'Feature' | 'Knowledge' | 'Image' | 'Variable' | 'Computed' | 'Action') => () => {
        switch(tag) {
            case 'Room':
                dispatch(addOnboardingComplete(['addRoom']))
                break
        }
        if (baseSchema.length === 0) {
            return
        }
        const rootItem = baseSchema[0]
        if (baseSchema.length > 1 || !isSchemaAsset(rootItem.data)) {
            throw new Error('Top-level asset error in AssetEdit update')
        }
        updateSchema({
            type: 'addChild',
            id: rootItem.id,
            item: { data: defaultItemFromTag(tag, ''), children: [] }
        })
    }, [baseSchema, updateSchema, dispatch])
    const innerSaveHandler = useCallback(() => {
        dispatch(addOnboardingComplete(['saveAsset'], { requireSequence: true }))
        save()
    }, [save, dispatch])
    const saveHandler = useCallback(() => {
        innerSaveHandler()
        if (!Boolean(serialized)) {
            setAssignDialogShown(true)
        }
    }, [innerSaveHandler, serialized, setAssignDialogShown])
    return <Box sx={{ position: "relative", display: 'flex', flexDirection: 'column', width: "100%", height: "100%" }}>
        <LibraryBanner
            primary={standardForm.key || 'Untitled'}
            secondary={'Asset'}
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
                                    <ListItemText primary={schemaOutputToString(themeItem.name.children) || 'Untitled'} secondary={themeItem.key} />
                                </ListItemButton>
                            ))}
                        </React.Fragment>
                        : null
                    }
                    <AddWMLComponent type="Theme" onAdd={addAsset('Theme')} />
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
                    <AddWMLComponent type="Map" onAdd={addAsset('Map')} />
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
                    { (variables || [])
                        .map((variable) => (<JSHeader
                            key={variable.id}
                            id={variable.id}
                            item={variable.data}
                            typeGuard={isSchemaVariable}
                            getJS={(item) => (item.default)}
                            schema={(key, value) => ({
                                key,
                                tag: 'Variable',
                                default: value
                            })}
                            maxHeight="4em"
                        />))
                    }
                    <AddWMLComponent type="Variable" onAdd={addAsset('Variable')} />
                    <ListSubheader>Computes</ListSubheader>
                    { (computes || []).map((compute) => (<JSHeader
                            key={compute.id}
                            id={compute.id}
                            item={compute.data}
                            typeGuard={isSchemaComputed}
                            getJS={(item) => (item.src)}
                            schema={(key, value) => ({
                                key,
                                tag: 'Computed',
                                src: value,
                                dependencies: extractDependenciesFromJS(value)
                            })}
                            maxHeight="8em"
                        />))
                    }
                    <AddWMLComponent type="Computed" onAdd={addAsset('Computed')} />
                    <ListSubheader>Actions</ListSubheader>
                    { (actions || []).map((action) => (<JSHeader
                            key={action.id}
                            id={action.id}
                            item={action.data}
                            typeGuard={isSchemaAction}
                            getJS={(item) => (item.src)}
                            schema={(key, value) => ({
                                key,
                                tag: 'Action',
                                src: value
                            })}
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
    const [assignDialogShown, setAssignDialogShown] = useState<boolean>(false)
    const Characters = useSelector(getMyCharacters)
    const assignHandler = useCallback(() => {
        if (isEphemeraAssetId(AssetId)) {
            //
            // TODO: ISS-3674: Figure out how to get DB-ID from Character, rather than namespace key, for this
            // assign
            //
            Characters.forEach(({ scopedId }) => {
                dispatch(assignAssetToCharacterId({ assetId: AssetId, characterId: `CHARACTER#${scopedId}` }))
            })
        }
    }, [AssetId, Characters, dispatch])

    return <React.Fragment>
        <AssetAssignDialog open={assignDialogShown} onClose={() => { setAssignDialogShown(false) }} assignHandler={assignHandler} />
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
                            <Route path={''} element={<AssetEditForm setAssignDialogShown={setAssignDialogShown} />} />
                        </Routes>
                    </LibraryAsset>
                    
                : <div style={{ height: "100%", width: "100%", display: "flex", alignItems: "center", justifyContent: "center" }}><div><CircularProgress /></div></div>
        }
    </React.Fragment>

}

export default EditAsset
