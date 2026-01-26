import React, { FunctionComponent, useMemo, useState, useCallback } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import {
    Box,
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
    Button,
    Typography,
    CircularProgress
} from '@mui/material'
import CloseIcon from '@mui/icons-material/Close'
import DownloadIcon from '@mui/icons-material/Download'

import { useWorkbenchAsset } from './useWorkbenchAsset'
import { getComponentIconByTag } from '../../lib/componentIcons'
import { addImport } from '../../slices/personalAssets'
import { AssetUUID, ComponentUUID } from '@tonylb/mtw-base/ts/schema'
import { Zone } from '@tonylb/mtw-interfaces/ts/baseClasses'
import { SchemaImportMapping } from '@tonylb/mtw-base/ts/schema/metaData'
import {
    getContentHeadersByZone,
    getComponentsForAsset,
    getComponentDisplayName,
    groupComponentsByType,
    ComponentGroup
} from '../../slices/contentHeaders/selectors'
import StandardRoom from '@tonylb/mtw-wml/ts/standardize/components/room'
import StandardFeature from '@tonylb/mtw-wml/ts/standardize/components/feature'
import StandardKnowledge from '@tonylb/mtw-wml/ts/standardize/components/knowledge'
import StandardMap from '@tonylb/mtw-wml/ts/standardize/components/map'
import StandardImage from '@tonylb/mtw-wml/ts/standardize/components/image'
import StandardCharacter from '@tonylb/mtw-wml/ts/standardize/components/character'
import { StandardComponent } from '@tonylb/mtw-wml/ts/standardize/components/baseClasses'

interface ImportComponentDialogProps {
    open: boolean
    onClose: () => void
    assetId: AssetUUID
}

export const WorkbenchImportComponentDialog: FunctionComponent<ImportComponentDialogProps> = ({ open, onClose, assetId }) => {
    const dispatch = useDispatch()
    const { standardForm: currentStandardForm } = useWorkbenchAsset()
    
    const [selectedZone, setSelectedZone] = useState<Zone>('Canon')
    const [selectedAssetId, setSelectedAssetId] = useState<AssetUUID | ''>('')

    const zoneAssets = useSelector((state: any) => getContentHeadersByZone(state, selectedZone))

    const components = useSelector((state: any) => 
        selectedAssetId ? getComponentsForAsset(state, selectedAssetId as AssetUUID) : []
    )

    const componentGroups = useMemo(() => groupComponentsByType(components), [components])

    const isComponentImported = useCallback((component: StandardComponent): boolean => {
        if (!component.universalKey) {
            return false
        }
        return component.universalKey in currentStandardForm.byUniversalId
    }, [currentStandardForm])

    const handleImport = useCallback((component: StandardComponent, fromAsset: AssetUUID) => {
        if (!component.universalKey) {
            return
        }

        let tag: SchemaImportMapping["type"]
        if (component instanceof StandardRoom) {
            tag = 'Room'
        } else if (component instanceof StandardFeature) {
            tag = 'Feature'
        } else if (component instanceof StandardKnowledge) {
            tag = 'Knowledge'
        } else if (component instanceof StandardMap) {
            tag = 'Map'
        } else {
            return
        }

        dispatch(addImport({
            assetId,
            fromAsset,
            uuid: component.universalKey as ComponentUUID,
            tag
        }))
        
        onClose()
    }, [dispatch, assetId, onClose])

    const handleZoneChange = useCallback((_event: React.SyntheticEvent, newZone: Zone) => {
        setSelectedZone(newZone)
        setSelectedAssetId('')
    }, [])

    useMemo(() => {
        if (zoneAssets.length === 1 && !selectedAssetId) {
            setSelectedAssetId(zoneAssets[0].assetId)
        }
    }, [zoneAssets, selectedAssetId])

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
                        value={selectedZone}
                        onChange={handleZoneChange}
                        aria-label="zone tabs"
                    >
                        <Tab label="Canon" value="Canon" />
                        <Tab label="Library" value="Library" />
                        <Tab label="Personal" value="Personal" />
                    </Tabs>

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
                                <List>
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
                                                const displayName = getComponentDisplayName(component)
                                                const isImported = isComponentImported(component)
                                                const componentKey = component.universalKey || component.key || 'unknown'

                                                return (
                                                    <ListItem
                                                        key={componentKey}
                                                        secondaryAction={
                                                            <Button
                                                                variant="outlined"
                                                                size="small"
                                                                startIcon={<DownloadIcon />}
                                                                disabled={isImported}
                                                                onClick={() => handleImport(component, selectedAssetId as AssetUUID)}
                                                            >
                                                                {isImported ? 'Imported' : 'Import'}
                                                            </Button>
                                                        }
                                                    >
                                                        <ListItemText
                                                            primary={displayName}
                                                            secondary={componentKey}
                                                        />
                                                    </ListItem>
                                                )
                                            })}
                                        </React.Fragment>
                                    ))}
                                </List>
                            ) : (
                                <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center', py: 4 }}>
                                    No components available in this asset
                                </Typography>
                            )}
                        </Box>
                    )}

                    {!selectedAssetId && zoneAssets.length > 0 && (
                        <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center', py: 4 }}>
                            Select an asset to view its components
                        </Typography>
                    )}
                </Box>
            </DialogContent>
        </Dialog>
    )
}

export default WorkbenchImportComponentDialog
