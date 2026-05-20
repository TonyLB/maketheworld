import React, { FunctionComponent, useCallback, useMemo, useState } from "react"
import Box from "@mui/material/Box"
import List from "@mui/material/List"
import ListItem from "@mui/material/ListItem"
import ListItemButton from "@mui/material/ListItemButton"
import ListItemIcon from "@mui/material/ListItemIcon"
import ListItemText from "@mui/material/ListItemText"
import IconButton from "@mui/material/IconButton"
import TextField from "@mui/material/TextField"
import Typography from "@mui/material/Typography"
import { useWorkbenchAsset } from "../foundations/useWorkbenchAsset"
import ExitIcon from '@mui/icons-material/CallMade'
import AddIcon from '@mui/icons-material/Add'
import DeleteIcon from '@mui/icons-material/Delete'
import { MakeTheWorldAccordion } from "../../UI"
import StandardRoom from "@tonylb/mtw-wml/ts/standardize/components/room"
import { StandardExitFacet } from "@tonylb/mtw-wml/ts/standardize/keys/facets/exit"
import { ComponentUUID } from "@tonylb/mtw-base/ts/schema"
import ComponentSelectorDialog from "../foundations/ComponentSelector/ComponentSelectorDialog"
import { componentDisplayLabel } from "../../../lib/componentDisplayLabel"

export type ExitEditorProps = {
    RoomId: ComponentUUID;
}

const ExitRowEditor: FunctionComponent<{
    exit: StandardExitFacet;
    onUpdate: (exit: StandardExitFacet) => void;
    onDelete: () => void;
    disabled?: boolean;
}> = ({ exit, onUpdate, onDelete, disabled }) => {
    const { readonly, standardForm } = useWorkbenchAsset()
    const isDisabled = readonly || disabled

    const handleDescriptionChange = useCallback((newDescription: string) => {
        if (!isDisabled) {
            const updatedExit = new StandardExitFacet({
                reference: exit.reference.toJSON(),
                payload: newDescription || undefined
            })
            onUpdate(updatedExit)
        }
    }, [exit, onUpdate, isDisabled])

    const targetRoomDisplay = useMemo(() => {
        let targetRoom: StandardRoom | undefined
        const targetUniversalKey = exit.reference.universalKey
        if (targetUniversalKey) {
            const byUniversalId = standardForm.byUniversalId[targetUniversalKey]
            if (byUniversalId instanceof StandardRoom) {
                targetRoom = byUniversalId
            }
        }
        if (!targetRoom && exit.reference.key) {
            const byLocalKey = standardForm.components.find((component) => (
                component instanceof StandardRoom &&
                component.key === exit.reference.key
            ))
            if (byLocalKey instanceof StandardRoom) {
                targetRoom = byLocalKey
            }
        }
        if (!targetRoom) {
            return 'Unknown room'
        }
        return componentDisplayLabel(targetRoom, { fallbackLabel: 'Untitled' }) ?? 'Untitled'
    }, [exit.reference, standardForm])

    const currentDescription = useMemo(() => {
        const desc = exit.payload.toJSON()
        return typeof desc === 'string' ? desc : ''
    }, [exit.payload])

    return (
        <ListItem
            sx={{
                border: '1px solid #e0e0e0',
                borderRadius: '8px',
                marginBottom: '8px',
                backgroundColor: 'white'
            }}
            secondaryAction={
                <IconButton
                    edge="end"
                    aria-label="delete exit"
                    onClick={onDelete}
                    disabled={isDisabled}
                    color="error"
                >
                    <DeleteIcon />
                </IconButton>
            }
        >
            <Box sx={{ display: 'flex', width: '100%', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
                <Typography
                    variant="body2"
                    sx={{
                        fontWeight: 700,
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        maxWidth: '40%'
                    }}
                    title={targetRoomDisplay}
                >
                    {targetRoomDisplay}
                </Typography>
                <ExitIcon sx={{ color: 'grey', fontSize: 20, flexShrink: 0 }} />
                <Box sx={{ flex: '1 1 240px', minWidth: 180 }}>
                    <TextField
                        label="Exit Name"
                        value={currentDescription}
                        onChange={(e) => handleDescriptionChange(e.target.value)}
                        disabled={isDisabled}
                        size="small"
                        fullWidth
                        placeholder="Enter exit name..."
                    />
                </Box>
            </Box>
        </ListItem>
    )
}

export const ExitEditor: FunctionComponent<ExitEditorProps> = ({ RoomId }) => {
    const { readonly, standardForm, updateStandard } = useWorkbenchAsset()
    const [isAddExitDialogOpen, setIsAddExitDialogOpen] = useState(false)

    const room = useMemo(() => {
        if (RoomId) {
            const component = standardForm.byUniversalId[RoomId]
            if (component && component instanceof StandardRoom) {
                return component
            }
        }
        return null
    }, [RoomId, standardForm])

    const exits = useMemo(() => room?.exits.items || [], [room])

    const exitSummary = useMemo(() => {
        if (!exits.length) return undefined
        const names = exits
            .map((e) => {
                const p = e.payload.toJSON()
                return typeof p === 'string' ? p : ''
            })
            .filter(Boolean)
        return names.length ? names.join(', ') : undefined
    }, [exits])

    const roomsByKey = useMemo<Record<string, ComponentUUID>>(() => (
        standardForm.components.reduce<Record<string, ComponentUUID>>((previous, component) => {
            if (component instanceof StandardRoom && component.key && component.universalKey) {
                previous[component.key] = component.universalKey
            }
            return previous
        }, {})
    ), [standardForm])

    const targetedRoomUniversalKeys = useMemo<Set<ComponentUUID>>(() => (
        exits.reduce<Set<ComponentUUID>>((previous, exit) => {
            const directUniversalKey = exit.reference.universalKey
            if (directUniversalKey) {
                previous.add(directUniversalKey)
                return previous
            }
            const localKey = exit.reference.key
            const lookedUpUniversalKey = localKey ? roomsByKey[localKey] : undefined
            if (lookedUpUniversalKey) {
                previous.add(lookedUpUniversalKey)
            }
            return previous
        }, new Set<ComponentUUID>())
    ), [exits, roomsByKey])

    const isExcludedFromAddExitSelector = useCallback((universalKey: ComponentUUID) => {
        if (room?.universalKey && room.universalKey === universalKey) {
            return true
        }
        return targetedRoomUniversalKeys.has(universalKey)
    }, [room, targetedRoomUniversalKeys])

    const hasAvailableAddExitTarget = useMemo(() => (
        standardForm.components.some((component) => (
            component instanceof StandardRoom &&
            Boolean(component.universalKey) &&
            !isExcludedFromAddExitSelector(component.universalKey as ComponentUUID)
        ))
    ), [standardForm, isExcludedFromAddExitSelector])

    const openAddExitSelector = useCallback(() => {
        if (readonly || !room || !hasAvailableAddExitTarget) return
        setIsAddExitDialogOpen(true)
    }, [readonly, room, hasAvailableAddExitTarget])

    const closeAddExitSelector = useCallback(() => {
        setIsAddExitDialogOpen(false)
    }, [])

    const addExitWithTarget = useCallback((targetRoomId: ComponentUUID) => {
        if (!room) return

        updateStandard({
            type: 'update',
            update: (component) => {
                const base = component.byUniversalId[RoomId]
                if (base instanceof StandardRoom) {
                    const newExitFacet = new StandardExitFacet({
                        reference: { tag: 'Room', universalKey: targetRoomId },
                        payload: undefined
                    })
                    base._payload._exits.items.push(newExitFacet)
                }
                return component
            }
        })
        setIsAddExitDialogOpen(false)
    }, [room, RoomId, updateStandard])

    const updateExit = useCallback((index: number, updatedExit: StandardExitFacet) => {
        if (!room) return

        updateStandard({
            type: 'update',
            update: (component) => {
                const base = component.byUniversalId[RoomId]
                if (base instanceof StandardRoom) {
                    base._payload._exits.items[index] = updatedExit
                }
                return component
            }
        })
    }, [room, RoomId, updateStandard])

    const deleteExit = useCallback((index: number) => {
        if (!room) return

        updateStandard({
            type: 'update',
            update: (component) => {
                const base = component.byUniversalId[RoomId]
                if (base instanceof StandardRoom) {
                    base._payload._exits.items.splice(index, 1)
                }
                return component
            }
        })
    }, [room, RoomId, updateStandard])

    if (!room) {
        return (
            <MakeTheWorldAccordion title="Exits" defaultExpanded>
                <Box sx={{ p: 2, textAlign: 'center', color: 'text.secondary' }}>
                    Room not found
                </Box>
            </MakeTheWorldAccordion>
        )
    }

    return (
        <MakeTheWorldAccordion title="Exits" defaultExpanded={false} summary={exitSummary}>
            <List>
                {exits.map((exit, index) => (
                    <ExitRowEditor
                        key={`${RoomId}-exit-${index}`}
                        exit={exit}
                        onUpdate={(updatedExit) => updateExit(index, updatedExit)}
                        onDelete={() => deleteExit(index)}
                    />
                ))}
                <ListItem>
                    <ListItemButton
                        onClick={openAddExitSelector}
                        disabled={readonly || !hasAvailableAddExitTarget}
                        sx={{ justifyContent: 'center' }}
                    >
                        <ListItemIcon>
                            <AddIcon />
                        </ListItemIcon>
                        <ListItemText primary="Add Exit" />
                    </ListItemButton>
                </ListItem>
            </List>
            <ComponentSelectorDialog
                open={isAddExitDialogOpen}
                onClose={closeAddExitSelector}
                tag="Room"
                onSelect={addExitWithTarget}
                isExcluded={isExcludedFromAddExitSelector}
            />
        </MakeTheWorldAccordion>
    )
}

export default ExitEditor
