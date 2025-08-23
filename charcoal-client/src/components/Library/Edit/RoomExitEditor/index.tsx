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
import { useLibraryAsset } from "../LibraryAsset"
import ExitIcon from '@mui/icons-material/CallMade'
import AddIcon from '@mui/icons-material/Add'
import DeleteIcon from '@mui/icons-material/Delete'
import SidebarTitle from "../SidebarTitle"
import StandardRoom from "@tonylb/mtw-wml/ts/standardize/components/room"
import { StandardExit } from "@tonylb/mtw-wml/ts/standardize/components/exit"

type RoomExitEditorProps = {
    RoomId: string;
}

const ExitTargetSelector: FunctionComponent<{ 
    target: string; 
    RoomId: string; 
    onChange: (target: string) => void;
    disabled?: boolean;
}> = ({ target, RoomId, onChange, disabled }) => {
    const { readonly, standardForm } = useLibraryAsset()
    
    const roomNamesInScope = useMemo<Record<string, string>>(() => {
        const roomKeys = Object.values(standardForm.byId)
            .filter((component): component is StandardRoom => (component instanceof StandardRoom))
            .map(({ key }) => (key))
        
        const roomNamesInScope: Record<string, string> = {}
        roomKeys
            .filter(key => key !== RoomId) // Don't show current room as target
            .forEach((key) => {
                if (key) { // Ensure key is defined
                    const component = standardForm.byId[key]
                    if (component && component instanceof StandardRoom) {
                        // Get room name from shortName or use key as fallback
                        let roomName = key
                        if (component.shortName) {
                            const shortNameData = component.shortName.toJSON()
                            if (typeof shortNameData === 'string') {
                                roomName = shortNameData
                            }
                        }
                        roomNamesInScope[key] = roomName
                    }
                }
            })
        return roomNamesInScope
    }, [RoomId, standardForm])

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
    exit: StandardExit;
    onUpdate: (exit: StandardExit) => void;
    onDelete: () => void;
    disabled?: boolean;
    currentRoomId: string;
}> = ({ exit, onUpdate, onDelete, disabled, currentRoomId }) => {
    const { readonly } = useLibraryAsset()
    const isDisabled = readonly || disabled

    const handleDescriptionChange = useCallback((newDescription: string) => {
        if (!isDisabled) {
            // Create a new exit with updated description
            const updatedExit = StandardExit.create({
                to: exit.plain?.to.toJSON() || { tag: 'Room', key: '' },
                description: newDescription ? newDescription : undefined
            })
            onUpdate(updatedExit)
        }
    }, [exit, onUpdate, isDisabled])

    const handleTargetChange = useCallback((newTarget: string) => {
        if (!isDisabled && newTarget) {
            // Create a new exit with updated target
            const updatedExit = StandardExit.create({
                to: { tag: 'Room', key: newTarget },
                description: exit.plain?.description?.toJSON()
            })
            onUpdate(updatedExit)
        }
    }, [exit, onUpdate, isDisabled])

    // Get the current description text safely
    const currentDescription = useMemo(() => {
        if (exit.plain?.description) {
            return exit.plain.description.toJSON()
        }
        return ''
    }, [exit.plain?.description])

    // Get the current target safely
    const currentTarget = useMemo(() => {
        if (exit.plain?.to) {
            return exit.plain.to.key || ''
        }
        return ''
    }, [exit.plain?.to])

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
                        RoomId={currentRoomId}
                        onChange={handleTargetChange}
                        disabled={isDisabled}
                    />
                </Box>
            </Box>
        </ListItem>
    )
}

export const RoomExitEditor: FunctionComponent<RoomExitEditorProps> = ({ RoomId }) => {
    const { standardForm, updateStandard } = useLibraryAsset()

    const room = useMemo(() => {
        if (RoomId) {
            const component = standardForm.byId[RoomId]
            if (component && component instanceof StandardRoom) {
                return component
            }
        }
        return null
    }, [RoomId, standardForm])

    const exits = useMemo(() => room?.exits || [], [room])

    const addExit = useCallback(() => {
        if (!room) return

        updateStandard({
            type: 'update',
            update: (component) => {
                const base = component.byId[RoomId]
                if (base instanceof StandardRoom) {
                    // Create a new empty exit
                    const newExit = StandardExit.create({
                        to: { tag: 'Room', key: '' },
                        description: undefined
                    })
                    base._payload._exits.push(newExit)
                }
                return component
            }
        })
    }, [room, RoomId, updateStandard])

    const updateExit = useCallback((index: number, updatedExit: StandardExit) => {
        if (!room) return

        updateStandard({
            type: 'update',
            update: (component) => {
                const base = component.byId[RoomId]
                if (base instanceof StandardRoom) {
                    base._payload._exits[index] = updatedExit
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
                const base = component.byId[RoomId]
                if (base instanceof StandardRoom) {
                    base._payload._exits.splice(index, 1)
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
                        currentRoomId={RoomId}
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

export default RoomExitEditor
