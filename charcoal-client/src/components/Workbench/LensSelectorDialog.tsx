import {
    Box,
    Dialog,
    DialogTitle,
    DialogContent,
    List,
    ListItemButton,
    ListItemText,
    ListSubheader,
    IconButton,
    Divider,
    Button
} from '@mui/material'
import CloseIcon from '@mui/icons-material/Close'
import AddIcon from '@mui/icons-material/Add'
import React, { FunctionComponent, useMemo } from 'react'
import { useWorkbenchAsset } from './foundations/useWorkbenchAsset'
import { StandardLens } from '@tonylb/mtw-wml/ts/standardize/components/worldState'
import { excludeUndefined } from '@tonylb/mtw-base/ts/utils/lists'
import { ComponentUUID } from '@tonylb/mtw-base/ts/schema'
import { v4 as uuidv4 } from 'uuid'

interface LensSelectorDialogProps {
    open: boolean
    onClose: () => void
    onSelectExisting: (universalKey: ComponentUUID) => void
    onCreateNew: () => void
}

const LensChoicesSubsection: FunctionComponent<{
    lenses: Array<{ key: string | undefined, universalKey: ComponentUUID | undefined, shortName?: string }>
    onSelect: (universalKey: ComponentUUID) => void
    onClose: () => void
}> = ({ lenses, onSelect, onClose }) => {
    return lenses.length
        ? <React.Fragment>
            <ListSubheader>Existing Lenses</ListSubheader>
            { lenses.map(({ key, universalKey, shortName }) => {
                if (!universalKey) return null
                const displayName = shortName || key || 'Untitled Lens'
                return (
                    <ListItemButton
                        key={universalKey}
                        onClick={() => {
                            onSelect(universalKey)
                            onClose()
                        }}
                    >
                        <ListItemText primary={displayName} secondary={universalKey} />
                    </ListItemButton>
                )
            })}
        </React.Fragment>
        : null
}

export const WorkbenchLensSelectorDialog: FunctionComponent<LensSelectorDialogProps> = ({
    open,
    onClose,
    onSelectExisting,
    onCreateNew
}) => {
    const { standardForm } = useWorkbenchAsset()
    
    const lenses = useMemo(() => {
        return Object.values(standardForm.byId)
            .filter((component): component is StandardLens => (component instanceof StandardLens))
            .map((lens) => {
                const shortName = lens.shortName?._payload?.plain?.toJSON()
                const shortNameStr = typeof shortName === 'string' ? shortName : undefined
                return {
                    key: lens.key,
                    universalKey: lens.universalKey,
                    shortName: shortNameStr
                }
            })
            .filter(({ universalKey }) => universalKey !== undefined)
    }, [standardForm])

    const handleCreateNew = () => {
        onCreateNew()
        onClose()
    }

    return (
        <Dialog
            open={open}
            scroll="paper"
            onClose={onClose}
            maxWidth="sm"
            fullWidth
        >
            <DialogTitle>
                <Box sx={{ marginRight: '2rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span>Select or Create Lens</span>
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
                <List>
                    <LensChoicesSubsection
                        lenses={lenses}
                        onSelect={onSelectExisting}
                        onClose={onClose}
                    />
                    <Divider sx={{ my: 2 }} />
                    <ListItemButton
                        onClick={handleCreateNew}
                        sx={{
                            border: '1px dashed #ccc',
                            borderRadius: '4px',
                            marginTop: '0.5em'
                        }}
                    >
                        <ListItemText
                            primary={
                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                    <AddIcon />
                                    <span>Create New Lens</span>
                                </Box>
                            }
                            secondary="Create a new lens component for this room"
                        />
                    </ListItemButton>
                </List>
            </DialogContent>
        </Dialog>
    )
}

export default WorkbenchLensSelectorDialog
