import React, { FunctionComponent, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useSelector, useDispatch } from 'react-redux'
import {
    Box,
    FormControl,
    InputLabel,
    Select,
    MenuItem,
    IconButton,
    Avatar,
    useMediaQuery
} from '@mui/material'
import EditIcon from '@mui/icons-material/Edit'

import { useActiveCharacter } from '../../ActiveCharacter';
import { addItem, setIntent } from '../../../slices/activeCharacters'
import { heartbeat } from '../../../slices/stateSeekingMachine/ssmHeartbeat'

import MapArea from '../Edit/Area'
import { EphemeraAssetId, EphemeraMapId, EphemeraCharacterId, isEphemeraMapId } from '@tonylb/mtw-interfaces/ts/baseClasses';
import { StandardForm } from '@tonylb/mtw-wml/ts/standardize';
import { AssetUUID, ComponentUUID } from '@tonylb/mtw-base/ts/schema';
import { MapDisplayController } from '../Controller';
import { AssetPicker } from '../../AssetPicker';
import { openWorkbench, setCurrentAssetId, setBreadcrumbStack, putWorkbenchSettings } from '../../../slices/UI/workbench';
import { addImportToDraft, getTopLevelAddToReferenceList, updateStandard } from '../../../slices/personalAssets';
import { useOnboardingCheckpoint } from '../../Onboarding/useOnboarding';
import TutorialPopover from '../../Onboarding/TutorialPopover';
import { getPlayer, getMyDraftAssets } from '../../../slices/player';

type MapViewProps = {
}

export const MapView: FunctionComponent<MapViewProps> = () => {
    const dispatch = useDispatch()
    const medium = useMediaQuery('(min-width: 600px)')
    const large = useMediaQuery('(min-width: 1200px)')
    const iconSize = large ? 50 : medium ? 40 : 30
    const { maps, CharacterId } = useActiveCharacter()
    const draftAssets = useSelector(getMyDraftAssets)
    // Get first draft asset for import target (or undefined if no drafts)
    const firstDraftAsset = draftAssets.length > 0 ? draftAssets[0] : undefined
    const firstDraftAssetId = firstDraftAsset?.AssetId
    useOnboardingCheckpoint('openMap', { requireSequence: true })
    useEffect(() => {
        dispatch(addItem({ key: CharacterId }))
        dispatch(setIntent({ key: CharacterId, intent: ['MAPSUBSCRIBED'] }))
        dispatch(heartbeat)
    }, [dispatch, CharacterId])
    const [MapId, setMapId] = useState<EphemeraMapId | undefined>(Object.keys(maps || {})[0] as EphemeraMapId | undefined)
    useEffect(() => {
        if (typeof MapId === 'undefined' && Object.keys(maps).length) {
            setMapId(Object.keys(maps || {})[0] as EphemeraMapId)
        }
    }, [MapId, setMapId, maps])
    const selectedMap = useMemo(() => (maps[MapId ?? 'MAP#']), [maps, MapId])
    const assets = useMemo(() => (selectedMap?.assets ?? {}), [selectedMap])
    const ref = useRef()
    const [open, setOpen] = useState<boolean>(false)
    const importOptions = useMemo(() => {
        if (Object.entries(assets).length > 1) {
            return Object.entries(assets)
                .filter(([asset]) => (asset !== 'ASSET#primitives'))
                .map(([asset, key]) => ({ asset: asset as EphemeraAssetId, key }))
        }
        else {
            return Object.entries(assets)
                .map(([asset, key]) => ({ asset: asset as EphemeraAssetId, key }))
        }
    }, [assets])
    
    // TODO: Map Import Flow - Technical Debt
    // This section needs comprehensive reconsideration when refactoring MapEdit.
    // The current implementation is a tangled mess of incoherent intent after removing
    // the single magic-draft pattern. The logic for:
    // - Selecting which draft to import into (currently just uses first draft)
    // - Handling the import flow when no drafts exist
    // - Determining the target asset for map room imports
    // ...all needs to be redesigned with multi-draft support in mind.
    const onImportListItemClick = useCallback(({ asset, key }: { asset: EphemeraAssetId, key: string }) => {
        // Import into first draft asset if available, then open workbench on that asset + map
        if (firstDraftAssetId) {
            const fromAssetKey = asset.split('#')[1]
            if (asset !== firstDraftAssetId && fromAssetKey) {
                const fromAsset = `ASSET#${fromAssetKey}` as AssetUUID
                const uuid = key.startsWith('MAP#') ? (key as ComponentUUID) : (`MAP#${key}` as ComponentUUID)
                dispatch(updateStandard(firstDraftAssetId)({
                    type: 'update',
                    update: (draft) => {
                        const ref = addImportToDraft(draft, { fromAsset, uuid, tag: 'Map' })
                        const descriptor = getTopLevelAddToReferenceList(draft)
                        if (ref && descriptor) descriptor.setReferenceList(descriptor.referenceList.assureItem(ref))
                        return draft
                    }
                }))
            }
            const mapComponentId = key.startsWith('MAP#') ? (key as ComponentUUID) : (`MAP#${key}` as ComponentUUID)
            dispatch(setCurrentAssetId(firstDraftAssetId))
            dispatch(setBreadcrumbStack([{ id: mapComponentId, kind: 'component', componentId: mapComponentId }]))
            dispatch(openWorkbench())
            dispatch(putWorkbenchSettings({ currentAssetId: firstDraftAssetId }))
            setOpen(false)
        }
    }, [firstDraftAssetId, dispatch])
    const onClick = useCallback(() => {
        if (importOptions.length > 1) {
            setOpen(true)
        }
        else {
            if (importOptions.length) {
                onImportListItemClick(importOptions[0])
            }
        }
    }, [importOptions, setOpen, onImportListItemClick])

    return <Box sx={{ height: "100%", width: "100%", position: "relative" }}>
        <Box sx={{ width: "100%", margin: ".5rem", display: "flex", justifyContent: "center" }}>
            <Box>
                <FormControl fullWidth>
                    <InputLabel id="map-view-select-label">Which Map</InputLabel>
                    <Select
                        sx={{ maxWidth: "400px" }}
                        labelId="map-view-select-label"
                        value={MapId || 'none'}
                        label="Which Map"
                        onChange={(event) => {
                            const mapId = event.target.value
                            if (isEphemeraMapId(mapId)) {
                                setMapId(mapId)
                            }
                        }}
                    >
                        {
                            Object.entries({ ...maps, ...(MapId ? {} : { none: { name: 'None selected', MapId: 'MAP#none' as EphemeraMapId, description: '', rooms: [], assets: {} }}) })
                                .map(([key, map]) => (
                                    <MenuItem key={key} value={key}>{map.name || 'Unnamed map'}</MenuItem>
                                ))
                        }
                    </Select>
                </FormControl>
            </Box>
        </Box>
        { MapId && maps[MapId]?.description && (() => {
            try {
                const standardForm = new StandardForm(maps[MapId].description)
                return <MapDisplayController standardForm={standardForm} mapId={MapId}>
                    <MapArea fileURL={maps[MapId].fileURL} editMode={false} />
                </MapDisplayController>
            } catch (error) {
                console.warn('Failed to parse map WML:', error)
                return null
            }
        })() }
        <Box sx={{ right: "2em", top: "0.25em", position: "absolute" }}>
            <Avatar
                sx={{ width: `${iconSize}px`, height: `${iconSize}px` }}
                alt={'Edit Map'}
                onClick={onClick}
                ref={ref as any}
            >
                <EditIcon sx={{ fontSize: iconSize * 0.6 }} />
            </Avatar>
            <TutorialPopover
                anchorEl={ref as any}
                placement='left'
                checkPoints={['editMap']}
            />
            <AssetPicker
                anchorRef={ref}
                open={open}
                setOpen={setOpen}
                assets={assets}
                onSelect={onImportListItemClick}
            />
        </Box>
    </Box>
}

export default MapView
