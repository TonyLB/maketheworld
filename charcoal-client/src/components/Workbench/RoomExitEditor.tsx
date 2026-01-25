import React, { FunctionComponent, useCallback, useMemo } from "react"
import Box from "@mui/material/Box"
import List from "@mui/material/List"
import ListItem from "@mui/material/ListItem"
import ListItemButton from "@mui/material/ListItemButton"
import ListItemIcon from "@mui/material/ListItemIcon"
import ListItemText from "@mui/material/ListItemText"
import IconButton from "@mui/material/IconButton"
import TextField from "@mui/material/TextField"
import Select, { SelectChangeEvent } from "@mui/material/Select"
import MenuItem from "@mui/material/MenuItem"
import FormControl from "@mui/material/FormControl"
import InputLabel from "@mui/material/InputLabel"
import { useWorkbenchAsset } from "./useWorkbenchAsset"
import ExitIcon from '@mui/icons-material/CallMade'
import AddIcon from '@mui/icons-material/Add'
import DeleteIcon from '@mui/icons-material/Delete'
import SidebarTitle from "../Library/Edit/SidebarTitle"
import StandardRoom from "@tonylb/mtw-wml/ts/standardize/components/room"
import { StandardExitFacet } from "@tonylb/mtw-wml/ts/standardize/keys/facets/exit"
import { ComponentUUID } from "@tonylb/mtw-base/ts/schema"

type RoomExitEditorProps = {
    RoomId: ComponentUUID;
}

const ExitTargetSelector: FunctionComponent<{ 
    target: string; 
    currentRoomKey: string | undefined;
    onChange: (target: string) => void;
    disabled?: boolean;
}> = ({ target, currentRoomKey, onChange, disabled }) => {
    const { readonly, standardForm } = useWorkbenchAsset()
    
    const roomNamesInScope = useMemo<Record<string, string>>(() => {
        const rooms = Object.values(standardForm.byUniversalId)
            .filter((component): component is StandardRoom => (component instanceof StandardRoom))
        
        const roomNamesInScope: Record<string, string> = {}
        rooms
            .filter(room => room.key !== currentRoomKey)
            .forEach((room) => {
                if (room.key) {
                    let roomName = room.key
                    if (room.shortName) {
                        const shortNameData = room.shortName.toJSON()
                        if (typeof shortNameData === 'string') {
                            roomName = shortNameData
                        }
                    }
                    roomNamesInScope[room.key] = roomName
                }
            })
        return roomNamesInScope
    }, [currentRoomKey, standardForm])

    const handleChange = useCallback((event: SelectChangeEvent<string>) => {
        if (!readonly && !disabled) {
            onChange(event.target.value)
        }
    }, [onChange, readonly, disabled])

    return (
        <FormControl size="small" disabled={readonly || disabled}>
            <InputLabel>Target Room</InputLabel>
            <Select
                value={target}
                label="Target Room"
                onChange={handleChange}
                sx={{ minWidth: 150, background: 'white' }}
            >
                <MenuItem value="">
                    <em>Select target room...</em>
                </MenuItem>
                {Object.entries(roomNamesInScope).map(([key, name]) => (
                    <MenuItem key={key} value={key}>
                        {name}
                    </MenuItem>
                ))}
            </Select>
        </FormControl>
    )
}

const ExitEditor: FunctionComponent<{
    exit: StandardExitFacet;
    onUpdate: (exit: StandardExitFacet) => void;
    onDelete: () => void;
    disabled?: boolean;
    currentRoomKey: string | undefined;
}> = ({ exit, onUpdate, onDelete, disabled, currentRoomKey }) => {
    const { readonly } = useWorkbenchAsset()
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

    const handleTargetChange = useCallback((newTarget: string) => {
        if (!isDisabled && newTarget) {
            const updatedExit = new StandardExitFacet({
                reference: { tag: 'Room', key: newTarget },
                payload: exit.payload.toJSON()
            })
            onUpdate(updatedExit)
        }
    }, [exit, onUpdate, isDisabled])

    const currentDescription = useMemo(() => {
        const desc = exit.payload.toJSON()
        return typeof desc === 'string' ? desc : ''
    }, [exit.payload])

    const currentTarget = useMemo(() => {
        return exit.reference.standardKey.key || ''
    }, [exit.reference])

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
            <Box sx={{ display: 'flex', flexDirection: 'column', width: '100%', gap: 1 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <ExitIcon sx={{ color: 'grey', fontSize: 20 }} />
                    <TextField
                        label="Exit Name"
                        value={currentDescription}
                        onChange={(e) => handleDescriptionChange(e.target.value)}
                        disabled={isDisabled}
                        size="small"
                        sx={{ flexGrow: 1 }}
                        placeholder="Enter exit name..."
                    />
                </Box>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <ExitTargetSelector
                        target={currentTarget}
                        currentRoomKey={currentRoomKey}
                        onChange={handleTargetChange}
                        disabled={isDisabled}
                    />
                </Box>
            </Box>
        </ListItem>
    )
}

export const WorkbenchRoomExitEditor: FunctionComponent<RoomExitEditorProps> = ({ RoomId }) => {
    const { standardForm, updateStandard } = useWorkbenchAsset()

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

    const addExit = useCallback(() => {
        if (!room) return

        updateStandard({
            type: 'update',
            update: (component) => {
                const base = component.byUniversalId[RoomId]
                if (base instanceof StandardRoom) {
                    const newExitFacet = new StandardExitFacet({
                        reference: { tag: 'Room', key: '' },
                        payload: undefined
                    })
                    base._payload._exits.items.push(newExitFacet)
                }
                return component
            }
        })
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
            <SidebarTitle title="Exits" minHeight="5em">
                <Box sx={{ p: 2, textAlign: 'center', color: 'text.secondary' }}>
                    Room not found
                </Box>
            </SidebarTitle>
        )
    }

    return (
        <SidebarTitle title="Exits" minHeight="5em">
            <List>
                {exits.map((exit, index) => (
                    <ExitEditor
                        key={`${RoomId}-exit-${index}`}
                        exit={exit}
                        onUpdate={(updatedExit) => updateExit(index, updatedExit)}
                        onDelete={() => deleteExit(index)}
                        currentRoomKey={room.key}
                    />
                ))}
                <ListItem>
                    <ListItemButton onClick={addExit} sx={{ justifyContent: 'center' }}>
                        <ListItemIcon>
                            <AddIcon />
                        </ListItemIcon>
                        <ListItemText primary="Add Exit" />
                    </ListItemButton>
                </ListItem>
            </List>
        </SidebarTitle>
    )
}

export default WorkbenchRoomExitEditor
