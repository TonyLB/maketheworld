import React, { FunctionComponent, useMemo, useState, useCallback, useEffect } from 'react'
import { useSelector } from 'react-redux'
import {
    Box,
    Collapse,
    Dialog,
    DialogTitle,
    DialogContent,
    IconButton,
    Tabs,
    Tab,
    Select,
    MenuItem,
    FormControl,
    InputLabel,
    List,
    ListSubheader,
    ListItem,
    ListItemText,
    ListItemButton,
    Typography
} from '@mui/material'
import CloseIcon from '@mui/icons-material/Close'
import DownloadIcon from '@mui/icons-material/Download'
import ExpandLess from '@mui/icons-material/ExpandLess'
import ExpandMore from '@mui/icons-material/ExpandMore'
import { blue } from '@mui/material/colors'

import { useWorkbenchAsset } from './foundations/useWorkbenchAsset'
import { getComponentIconByTag } from '../../lib/componentIcons'
import { getRecentlyVisited } from '../../slices/messages/selectors'
import { AssetUUID, ComponentUUID } from '@tonylb/mtw-base/ts/schema'
import { Zone } from '@tonylb/mtw-interfaces/ts/baseClasses'
import { SchemaImportMapping } from '@tonylb/mtw-base/ts/schema/metaData'
import {
    getContentHeadersByZone,
    getComponentsForAsset,
    groupComponentsByType,
    ComponentGroup
} from '../../slices/contentHeaders/selectors'
import { componentDisplayLabel } from '../../lib/componentDisplayLabel'
import StandardRoom from '@tonylb/mtw-wml/ts/standardize/components/room'
import StandardArea from '@tonylb/mtw-wml/ts/standardize/components/area'
import StandardFeature from '@tonylb/mtw-wml/ts/standardize/components/feature'
import StandardKnowledge from '@tonylb/mtw-wml/ts/standardize/components/knowledge'
import StandardMap from '@tonylb/mtw-wml/ts/standardize/components/map'
import StandardImage from '@tonylb/mtw-wml/ts/standardize/components/image'
import { StandardLens } from '@tonylb/mtw-wml/ts/standardize/components/worldState'
import { StandardComponent } from '@tonylb/mtw-wml/ts/standardize/components/baseClasses'

type ImportTab = 'RecentlyVisited' | Zone

interface ImportComponentDialogProps {
    open: boolean
    onClose: () => void
    assetId: AssetUUID
    /** Called when user selects a component to import. Caller typically runs addImportToDraft inside updateStandard and associates the ref (see AddReferenceImportControl). */
    onImportSelect: (fromAsset: AssetUUID, uuid: ComponentUUID, tag: SchemaImportMapping['type']) => void
    /** When set, filter components to this type only (zone tabs and Recently Visited). */
    tag?: SchemaImportMapping['type']
    /** When true for a universalKey, that component is omitted from the list (e.g. already in the reference list). */
    isExcluded?: (universalKey: ComponentUUID) => boolean
}

function componentToImportTag(component: StandardComponent): SchemaImportMapping['type'] | null {
    if (component instanceof StandardRoom) return 'Room'
    if (component instanceof StandardArea) return 'Area'
    if (component instanceof StandardFeature) return 'Feature'
    if (component instanceof StandardKnowledge) return 'Knowledge'
    if (component instanceof StandardMap) return 'Map'
    if (component instanceof StandardLens) return 'Lens'
    return null
}

const SECTION_ORDER: SchemaImportMapping['type'][] = [
    'Room',
    'Area',
    'Feature',
    'Knowledge',
    'Map',
    'Lens'
]

export const ImportComponentDialog: FunctionComponent<ImportComponentDialogProps> = ({
    open,
    onClose,
    assetId,
    onImportSelect,
    tag: tagFilter,
    isExcluded
}) => {
    const { standardForm: currentStandardForm } = useWorkbenchAsset()

    const [selectedTab, setSelectedTab] = useState<ImportTab>('RecentlyVisited')
    const [selectedZone, setSelectedZone] = useState<Zone>('Canon')
    const [selectedAssetId, setSelectedAssetId] = useState<AssetUUID | ''>('')
    const [recentCollapseStates, setRecentCollapseStates] = useState<Record<string, boolean>>({})

    const recentlyVisitedTimestamp = useMemo(() => Date.now() - 1000 * 60 * 15, [])
    const recentlyVisited = useSelector(getRecentlyVisited(recentlyVisitedTimestamp))

    const importsFromStandard = useMemo(
        () =>
            currentStandardForm._components
                .map((component) => {
                    const importItem = component._from
                    if (importItem && component.universalKey) {
                        return [{ fromAssetId: importItem, universalKey: component.universalKey }]
                    }
                    return []
                })
                .flat(1),
        [currentStandardForm._components]
    )

    const recentlyVisitedByAssetRaw = useMemo(() => {
        return recentlyVisited.reduce<
            Record<AssetUUID, { universalKey: ComponentUUID; name: string; tag: SchemaImportMapping['type'] }[]>
        >((previous, { name, assets, tag }) => {
            if (
                assets.some(({ fromAssetId, universalKey }) =>
                    importsFromStandard.some(
                        (importItem) =>
                            importItem.fromAssetId === fromAssetId && importItem.universalKey === universalKey
                    )
                )
            ) {
                return previous
            }
            return assets.reduce<
                Record<string, { universalKey: ComponentUUID; name: string; tag: SchemaImportMapping['type'] }[]>
            >(
                (accumulator, { fromAssetId, universalKey }) => ({
                    ...accumulator,
                    [fromAssetId]: [...(accumulator[fromAssetId] ?? []), { universalKey, name, tag }]
                }),
                previous
            )
        }, {})
    }, [recentlyVisited, importsFromStandard])

    const recentlyVisitedByAsset = useMemo(() => {
        let entries = Object.entries(recentlyVisitedByAssetRaw)
        if (tagFilter) {
            entries = entries.map(([assetId, list]) => [
                assetId,
                list.filter((item) => item.tag === tagFilter)
            ] as const)
        }
        if (isExcluded) {
            entries = entries.map(([assetId, list]) => [
                assetId,
                list.filter((item) => !isExcluded(item.universalKey))
            ] as const)
        }
        return Object.fromEntries(entries.filter(([, list]) => list.length > 0))
    }, [recentlyVisitedByAssetRaw, tagFilter, isExcluded])

    const hasRecentItems = Object.keys(recentlyVisitedByAsset).length > 0

    const zoneAssets = useSelector((state: any) => getContentHeadersByZone(state, selectedZone))

    const componentsRaw = useSelector((state: any) =>
        selectedAssetId ? getComponentsForAsset(state, selectedAssetId as AssetUUID) : []
    )

    const components = useMemo(() => {
        let list = componentsRaw
        if (tagFilter) {
            list = list.filter((c) => componentToImportTag(c) === tagFilter)
        }
        if (isExcluded) {
            list = list.filter((c) => !c.universalKey || !isExcluded(c.universalKey))
        }
        return list
    }, [componentsRaw, tagFilter, isExcluded])

    const componentGroups = useMemo(() => {
        const groups = groupComponentsByType([...components])
        return SECTION_ORDER.filter((t) => groups.some((g) => g.type === t)).map((t) => ({
            type: t,
            components: groups.find((g) => g.type === t)!.components
        }))
    }, [components])

    const isComponentImported = useCallback(
        (component: StandardComponent): boolean => {
            if (!component.universalKey) {
                return false
            }
            return component.universalKey in currentStandardForm.byUniversalId
        },
        [currentStandardForm]
    )

    const handleImport = useCallback(
        (component: StandardComponent, fromAsset: AssetUUID) => {
            if (!component.universalKey) {
                return
            }

            let tag: SchemaImportMapping['type']
            if (component instanceof StandardRoom) {
                tag = 'Room'
            } else if (component instanceof StandardArea) {
                tag = 'Area'
            } else if (component instanceof StandardFeature) {
                tag = 'Feature'
            } else if (component instanceof StandardKnowledge) {
                tag = 'Knowledge'
            } else if (component instanceof StandardMap) {
                tag = 'Map'
            } else if (component instanceof StandardLens) {
                tag = 'Lens'
            } else {
                return
            }

            onImportSelect(fromAsset, component.universalKey as ComponentUUID, tag)
            onClose()
        },
        [onClose, onImportSelect]
    )

    const handleImportFromRecent = useCallback(
        (fromAsset: AssetUUID, universalKey: ComponentUUID, tag: SchemaImportMapping['type']) => {
            onImportSelect(fromAsset, universalKey, tag)
            onClose()
        },
        [onClose, onImportSelect]
    )

    const handleTabChange = useCallback(
        (_event: React.SyntheticEvent, newTab: ImportTab) => {
            setSelectedTab(newTab)
            if (newTab !== 'RecentlyVisited') {
                setSelectedZone(newTab)
                setSelectedAssetId('')
            }
        },
        []
    )

    useEffect(() => {
        if (selectedTab !== 'RecentlyVisited' && zoneAssets.length === 1 && !selectedAssetId) {
            setSelectedAssetId(zoneAssets[0].assetId)
        }
    }, [selectedTab, zoneAssets, selectedAssetId])

    const getAssetDisplayName = (assetId: AssetUUID): string => {
        return assetId.split('#')[1] || assetId
    }

    return (
        <Dialog
            open={open}
            onClose={onClose}
            scroll="paper"
            maxWidth="md"
            fullWidth
        >
            <DialogTitle>
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <Typography variant="h6">Import Component</Typography>
                    <IconButton
                        aria-label="close"
                        onClick={onClose}
                        sx={{
                            position: 'absolute',
                            right: 8,
                            top: 8
                        }}
                    >
                        <CloseIcon />
                    </IconButton>
                </Box>
            </DialogTitle>
            <DialogContent>
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 1 }}>
                    <Tabs
                        value={selectedTab}
                        onChange={handleTabChange}
                        aria-label="import source tabs"
                    >
                        <Tab label="Recently Visited" value="RecentlyVisited" />
                        <Tab label="Canon" value="Canon" />
                        <Tab label="Library" value="Library" />
                        <Tab label="Personal" value="Personal" />
                    </Tabs>

                    {selectedTab === 'RecentlyVisited' && (
                        <Box>
                            {hasRecentItems ? (
                                <List dense>
                                    <ListSubheader>Components you visited recently (e.g. in chat)</ListSubheader>
                                    {Object.entries(recentlyVisitedByAsset).map(([fromAssetId, visitList]) => (
                                        <React.Fragment key={fromAssetId}>
                                            <ListItemButton
                                                sx={{
                                                    bgcolor: blue[100],
                                                    borderRadius: 1,
                                                    mb: 0.5,
                                                    '&:hover': { bgcolor: blue[200] }
                                                }}
                                                onClick={() =>
                                                    setRecentCollapseStates((prev) => ({
                                                        ...prev,
                                                        [fromAssetId]: !prev[fromAssetId]
                                                    }))
                                                }
                                            >
                                                <ListItemText primary={`From: ${fromAssetId.split('#').slice(-1)[0]}`} />
                                                {recentCollapseStates[fromAssetId] ? (
                                                    <ExpandLess />
                                                ) : (
                                                    <ExpandMore />
                                                )}
                                            </ListItemButton>
                                            <Collapse in={recentCollapseStates[fromAssetId] ?? false}>
                                                <List disablePadding sx={{ pl: 2 }}>
                                                    {visitList.map(({ name, universalKey, tag }, index) => (
                                                        <ListItem
                                                            key={`recent-${fromAssetId}-${index}`}
                                                            secondaryAction={
                                                                <IconButton
                                                                    aria-label="Import"
                                                                    onClick={() =>
                                                                        handleImportFromRecent(
                                                                            fromAssetId as AssetUUID,
                                                                            universalKey,
                                                                            tag
                                                                        )
                                                                    }
                                                                >
                                                                    <DownloadIcon />
                                                                </IconButton>
                                                            }
                                                            sx={{
                                                                border: '1px solid',
                                                                borderColor: blue[400],
                                                                borderRadius: 1,
                                                                mb: 0.5
                                                            }}
                                                        >
                                                            <ListItemText primary={name} secondary={universalKey} />
                                                        </ListItem>
                                                    ))}
                                                </List>
                                            </Collapse>
                                        </React.Fragment>
                                    ))}
                                </List>
                            ) : (
                                <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center', py: 4 }}>
                                    No recently visited components to import. Use the Canon, Library, or Personal tab to
                                    browse by zone, or visit rooms, features, etc. in the story and they’ll appear here.
                                </Typography>
                            )}
                        </Box>
                    )}

                    {selectedTab !== 'RecentlyVisited' && (
                        <>
                            {zoneAssets.length > 0 ? (
                                <FormControl fullWidth>
                                    <InputLabel id="asset-select-label">Select Asset</InputLabel>
                                    <Select
                                        labelId="asset-select-label"
                                        value={selectedAssetId}
                                        label="Select Asset"
                                        onChange={(e) => setSelectedAssetId(e.target.value as AssetUUID)}
                                    >
                                        {zoneAssets.map((asset) => (
                                            <MenuItem key={asset.assetId} value={asset.assetId}>
                                                {getAssetDisplayName(asset.assetId)}
                                            </MenuItem>
                                        ))}
                                    </Select>
                                </FormControl>
                            ) : (
                                <Typography variant="body2" color="text.secondary">
                                    No assets available in {selectedZone} zone
                                </Typography>
                            )}

                            {selectedAssetId && (
                                <Box>
                                    {componentGroups.length > 0 ? (
                                        <List dense>
                                            {componentGroups.map((group) => (
                                                <React.Fragment key={group.type}>
                                                    <ListSubheader>
                                                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                                            {getComponentIconByTag(group.type)}
                                                            <Typography variant="subtitle2">
                                                                {group.type}s ({group.components.length})
                                                            </Typography>
                                                        </Box>
                                                    </ListSubheader>
                                                    {group.components.map((component) => {
                                                        const displayName = componentDisplayLabel(component, { fallbackLabel: 'Untitled' })
                                                        const isImported = isComponentImported(component)
                                                        const componentKey =
                                                            component.universalKey || component.key || 'unknown'

                                                        return (
                                                            <ListItemButton
                                                                key={componentKey}
                                                                disabled={isImported}
                                                                onClick={() =>
                                                                    handleImport(
                                                                        component,
                                                                        selectedAssetId as AssetUUID
                                                                    )
                                                                }
                                                            >
                                                                <ListItemText
                                                                    primary={displayName}
                                                                    secondary={componentKey}
                                                                />
                                                                {!isImported && (
                                                                    <DownloadIcon sx={{ ml: 1, fontSize: '1.25rem' }} />
                                                                )}
                                                            </ListItemButton>
                                                        )
                                                    })}
                                                </React.Fragment>
                                            ))}
                                        </List>
                                    ) : (
                                        <Typography
                                            variant="body2"
                                            color="text.secondary"
                                            sx={{ textAlign: 'center', py: 4 }}
                                        >
                                            No components available in this asset
                                        </Typography>
                                    )}
                                </Box>
                            )}

                            {!selectedAssetId && zoneAssets.length > 0 && (
                                <Typography
                                    variant="body2"
                                    color="text.secondary"
                                    sx={{ textAlign: 'center', py: 4 }}
                                >
                                    Select an asset to view its components
                                </Typography>
                            )}
                        </>
                    )}
                </Box>
            </DialogContent>
        </Dialog>
    )
}

export default ImportComponentDialog
