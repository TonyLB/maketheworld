import React, { FunctionComponent, useEffect, useMemo, useCallback, useState } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import {
    Box,
    CircularProgress,
    Button,
    IconButton,
    List,
    ListSubheader,
    Typography,
    Divider
} from '@mui/material'

import FeatureIcon from '@mui/icons-material/Search'
import KnowledgeIcon from '@mui/icons-material/School'
import AddIcon from '@mui/icons-material/Add'
import MapIcon from '@mui/icons-material/Map'
import PersonIcon from '@mui/icons-material/Person'

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
    getStatus
} from '../../../slices/personalAssets'
import { heartbeat } from '../../../slices/stateSeekingMachine/ssmHeartbeat'

import WMLEdit from './WMLEdit'
import WMLComponentHeader from './WMLComponentHeader'
import WMLComponentDetail from './WMLComponentDetail'
import MapEdit from '../../Maps/Edit'
import LibraryBanner from './LibraryBanner'
import LibraryAsset, { useLibraryAsset } from './LibraryAsset'
import ImageHeader from './ImageHeader'
import DraftLockout from './DraftLockout'
import { addOnboardingComplete } from '../../../slices/player/index.api'
import { useOnboardingCheckpoint } from '../../Onboarding/useOnboarding'
import StandardCharacter from '@tonylb/mtw-wml/ts/standardize/components/character'
import StandardRoom from '@tonylb/mtw-wml/ts/standardize/components/room'
import StandardFeature from '@tonylb/mtw-wml/ts/standardize/components/feature'
import StandardKnowledge from '@tonylb/mtw-wml/ts/standardize/components/knowledge'
import StandardMap from '@tonylb/mtw-wml/ts/standardize/components/map'
import StandardImage from '@tonylb/mtw-wml/ts/standardize/components/image'
import { standardComponentByTag } from '@tonylb/mtw-wml/ts/standardize/nonEditFactory'
import { RecentlyVisited } from './RecentlyVisited'
import { LabelledIndentBox } from './LabelledIndentBox'
import { blue } from '@mui/material/colors'
import EditCharacter from './EditCharacter'
import StandardLiteralEditor from './StandardLiteralEditor'
import StandardRenderEditor from './StandardRenderEditor'
import { StandardLiteral } from '@tonylb/mtw-wml/ts/standardize/literal'
import { StandardRender } from '@tonylb/mtw-wml/ts/standardize/render'
import { StandardForm } from '@tonylb/mtw-wml/ts/standardize'

type AssetEditFormProps = {}

const AddWMLComponent: FunctionComponent<{ type: 'Theme' | 'Character' | 'Map' | 'Room' | 'Feature' | 'Knowledge' | 'Image'; onAdd: () => void }> = ({ type, onAdd }) => (
    <Button
        onClick={onAdd}
        variant='contained'
        startIcon={<AddIcon />}
        sx={{ margin: '0.5em' }}
    >
        {type}
    </Button>
)

const AssetEditForm: FunctionComponent<AssetEditFormProps> = () => {
    const { updateStandard, standardForm, readonly, assetKey } = useLibraryAsset()
    useOnboardingCheckpoint('navigateBackToDraft', { requireSequence: true, condition: assetKey === 'draft' })
    const navigate = useNavigate()

    // Asset-level metadata editing (ShortName and Summary) - only for drafts
    // Memoize to avoid creating new objects on every render when values are undefined
    const shortName = useMemo(() => 
        standardForm.shortName ?? new StandardLiteral(''), 
        [standardForm.shortName]
    )
    const summary = useMemo(() => 
        standardForm.summary ?? new StandardRender([]), 
        [standardForm.summary]
    )
    
    // Extract display name for banner: use ShortName if available, otherwise extract UUID from universalKey
    const displayName = useMemo(() => 
        shortName._payload?.plain?.toJSON() || 
        standardForm.universalKey.replace('ASSET#', '').slice(0, 8) || 
        'Untitled',
        [shortName, standardForm.universalKey]
    )

    // Handle ShortName changes - StandardLiteralEditor handles its own debouncing
    const handleShortNameChange = useCallback((value: StandardLiteral) => {
        updateStandard({
            type: 'update',
            update: (draft: StandardForm) => {
                draft._shortName = value._payload?.plain?.toJSON() ? value : undefined
                return draft
            }
        })
    }, [updateStandard])

    // Handle Summary changes - StandardRenderEditor handles its own debouncing
    const handleSummaryChange = useCallback((value: StandardRender) => {
        updateStandard({
            type: 'update',
            update: (draft: StandardForm) => {
                draft._summary = value
                return draft
            }
        })
    }, [updateStandard])

    //
    // TODO: Refactor below into a single reduce statement that updates a record of lists.
    //
    const characters = useMemo<StandardCharacter[]>(() => (Object.values(standardForm?.byId || {}).filter((value): value is StandardCharacter => (value instanceof StandardCharacter))), [standardForm])
    const rooms = useMemo<StandardRoom[]>(() => (Object.values(standardForm?.byId || {}).filter((value): value is StandardRoom => (value instanceof StandardRoom))), [standardForm])
    const features = useMemo<StandardFeature[]>(() => (Object.values(standardForm?.byId || {}).filter((value): value is StandardFeature => (value instanceof StandardFeature))), [standardForm])
    const knowledges = useMemo<StandardKnowledge[]>(() => (Object.values(standardForm?.byId || {}).filter((value): value is StandardKnowledge => (value instanceof StandardKnowledge))), [standardForm])
    const maps = useMemo<StandardMap[]>(() => (Object.values(standardForm?.byId || {}).filter((value): value is StandardMap => (value instanceof StandardMap))), [standardForm])
    const images = useMemo<StandardImage[]>(() => (Object.values(standardForm?.byId || {}).filter((value): value is StandardImage => (value instanceof StandardImage))), [standardForm])

    const dispatch = useDispatch()
    const addAsset = useCallback((tag: 'Character' | 'Map' | 'Room' | 'Feature' | 'Knowledge' | 'Image') => () => {
        switch(tag) {
            case 'Room':
                dispatch(addOnboardingComplete(['addRoom']))
                break
        }
        updateStandard({
            type: 'update',
            update: (draft) => {
                let nextIndex = 1
                while (`${tag}${nextIndex}` in draft.byId) { nextIndex++ }
                const defaultedKey = `${tag}${nextIndex}`
                const component = standardComponentByTag(tag, defaultedKey)
                if (component) {
                    draft._components = [...draft._components, component]
                }
                else {
                    throw new Error(`Invalid tag: ${tag}`)
                }
                return draft
            }
        })
    }, [updateStandard, dispatch])
    return <Box sx={{ position: "relative", display: 'flex', flexDirection: 'column', width: "100%", height: "100%" }}>
        <LibraryBanner
            primary={displayName}
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
                    label: displayName
            }]}
        />
        { !readonly && (
            <Box sx={{ marginLeft: "20px", marginRight: "20px", marginTop: "1em", marginBottom: "1em" }}>
                <Typography variant="h6" sx={{ marginBottom: "0.5em" }}>Metadata</Typography>
                <Divider sx={{ marginBottom: "1em" }} />
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                    <Box>
                        <Typography variant="subtitle2" sx={{ marginBottom: "0.5em" }}>Short Name</Typography>
                        <StandardLiteralEditor
                            value={shortName}
                            onChange={handleShortNameChange}
                            placeholder="Enter a short name for this draft"
                            readonly={readonly}
                        />
                    </Box>
                    <Box>
                        <Typography variant="subtitle2" sx={{ marginBottom: "0.5em" }}>Summary</Typography>
                        <Box sx={{
                            backgroundColor: 'background.paper',
                            border: '1px solid',
                            borderColor: 'divider',
                            borderRadius: '4px',
                            padding: '0.5em'
                        }}>
                            <StandardRenderEditor
                                value={summary}
                                onChange={handleSummaryChange}
                                validLinkTags={[]}
                                toolbar={false}
                            />
                        </Box>
                    </Box>
                </Box>
                <Divider sx={{ marginTop: "1em" }} />
            </Box>
        )}
        <Box sx={{ display: 'flex', position: "relative", width: "100%", flexGrow: 1, overflowY: "auto" }}>
            <Box sx={{ marginLeft: "20px", width: "calc(100% - 20px)" }}>
                <RecentlyVisited />
                <List dense>
                    <ListSubheader>Components</ListSubheader>
                    { characters.length
                        ? characters.map((characterItem) => (<WMLComponentHeader
                                key={characterItem.key}
                                ItemId={characterItem.universalKey ?? ''}
                                onClick={() => { navigate(`Character/${characterItem.key}`)}}
                                icon={<PersonIcon />}
                            />))
                        : null
                    }
                    { maps.length
                        ? maps.map((mapItem) => (<WMLComponentHeader
                                key={mapItem.key}
                                ItemId={mapItem.universalKey ?? ''}
                                onClick={() => { navigate(`Map/${mapItem.key}`)}}
                                icon={<MapIcon />}
                            />))
                        : null
                    }
                    { rooms.length
                        ? rooms.map((room) => (<WMLComponentHeader
                                key={room.key}
                                ItemId={room.universalKey ?? ''}
                                onClick={() => { navigate(`Room/${room.key}`)}}
                            />))
                        : null
                    }
                    { features.length
                        ? features.map((feature) => (<WMLComponentHeader
                                key={feature.key}
                                ItemId={feature.universalKey ?? ''}
                                onClick={() => { navigate(`Feature/${feature.key}`)}}
                                icon={<FeatureIcon />}
                            />))
                        : null
                    }
                    { knowledges.length
                        ? knowledges.map((knowledge) => (<WMLComponentHeader
                                key={knowledge.key}
                                ItemId={knowledge.universalKey ?? ''}
                                onClick={() => { navigate(`Knowledge/${knowledge.key}`)}}
                                icon={<KnowledgeIcon />}
                            />))
                        : null
                    }
                    { images.length
                        ? images.map((image) => (<ImageHeader
                                key={image.key}
                                ItemId={image.universalKey ?? ''}
                                onClick={() => {}}
                            />))
                        : null
                    }
                </List>
            </Box>
            <DraftLockout />
        </Box>
        { !readonly &&
            <LabelledIndentBox label="Add Component" color={blue}>
                <AddWMLComponent type="Character" onAdd={addAsset('Character')} />
                <AddWMLComponent type="Map" onAdd={addAsset('Map')} />
                <AddWMLComponent type="Room" onAdd={addAsset('Room')} />
                <AddWMLComponent type="Feature" onAdd={addAsset('Feature')} />
                <AddWMLComponent type="Knowledge" onAdd={addAsset('Knowledge')} />
                <AddWMLComponent type="Image" onAdd={addAsset('Image')} />
            </LabelledIndentBox>
        }
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
                            <Route path={'Character/:ComponentId'} element={<EditCharacter />} />
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
