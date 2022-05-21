import React, { FunctionComponent, useState, useMemo, useCallback } from 'react'

import {
    Box,
    ListItem,
    ListItemButton,
    ListItemText,
    ListItemIcon,
    Button,
    TextField,
    Select,
    MenuItem,
    FormControl,
    InputLabel
} from '@mui/material'
import AddIcon from '@mui/icons-material/Add'

import { useLibraryAsset } from './LibraryAsset'

interface AddRoomExitProps {
    RoomId: string;
    onAdd?: (toTarget: boolean, targetId: string) => void;
}

type ExitSelectOptionMapping = {
    value: string;
    name: string;
}

type ExitSelectOptions = {
    to: ExitSelectOptionMapping[];
    from: ExitSelectOptionMapping[];
}

export const AddRoomExit: FunctionComponent<AddRoomExitProps> = ({ RoomId, onAdd = () => { }}) => {
    const { rooms, exits, inheritedExits } = useLibraryAsset()
    const [enteringKey, setEnteringKey] = useState<boolean>(false)
    const [toTarget, setToTarget] = useState<boolean>(true)
    const [target, setTarget] = useState<string>('')
    const errorMessage = useMemo<string>(() => {
        if (!target) {
            return `Specify a room for the exit to lead to`
        }
        return ''
    }, [target])
    const exitOptions = useMemo<ExitSelectOptions>(() => {
        const allPossibleOptions = Object.entries(rooms)
            .filter(([key]) => (key !== RoomId))
            .map(([key, { name }]) => ({ value: key, name }))
        return {
            to: allPossibleOptions.filter(({ value: targetId }) => (!Object.values(exits).find(({ from, to }) => (from === RoomId && to === targetId)))),
            from: allPossibleOptions.filter(({ value: targetId }) => (!Object.values(exits).find(({ from, to }) => (to === RoomId && from === targetId))))
        }
    }, [rooms, exits, inheritedExits])
    const onToTargetChange = useCallback((event) => {
        setToTarget(Boolean(event.target.value === 'true'))
        setTarget('')
    }, [setToTarget, setTarget])
    const onTargetChange = useCallback((event) => { setTarget(event.target.value) }, [setTarget])
    const contents = <React.Fragment>
        <ListItemIcon>
            <AddIcon />
        </ListItemIcon>
        {
            (enteringKey === false) && <ListItemText primary={`Add Exit`} />
        }
        {
            (enteringKey === true) &&
                <Box sx={{ display: 'flex', flexDirection: 'column' }}>
                    <Box>
                        <FormControl sx={{ m: 1, minWidth: 120, alignContent: 'center', justifyContent: 'center' }} size="small">
                            <InputLabel id="to-from-exit-target">To/From</InputLabel>
                            <Select
                                labelId="to-from-exit-target"
                                id="to-from-exit-target"
                                value={toTarget ? 'true' : 'false'}
                                label="To/From"
                                onChange={onToTargetChange}
                            >
                                <MenuItem value='true'>To</MenuItem>
                                <MenuItem value='false'>From</MenuItem>
                            </Select>
                        </FormControl>
                        <FormControl sx={{ m: 1, minWidth: 120 }} size="small">
                            <InputLabel id="exit-target">Other Room</InputLabel>
                            <Select
                                labelId="exit-target"
                                id="exit-target"
                                value={target}
                                label="Other Room"
                                onChange={onTargetChange}
                            >
                                <MenuItem value=''>None</MenuItem>
                                {
                                    (toTarget ? exitOptions.to : exitOptions.from)
                                        .map(({ value, name }) => (
                                            <MenuItem key={value} value={value}>{ name }</MenuItem>
                                        ))
                                }
                            </Select>
                        </FormControl>

                        <Button sx={{ marginTop: '0.65em', marginRight: '0.25em' }} disabled={Boolean(errorMessage)} variant="contained" onClick={() => {
                            onAdd(toTarget, target)
                            setEnteringKey(false)
                            setToTarget(true)
                            setTarget('')
                        } }>Add</Button>
                        <Button sx={{ marginTop: '0.65em' }} variant="outlined" onClick={() => { setEnteringKey(false) }}>Cancel</Button>
                    </Box>
                    { errorMessage && <Box sx={{ color: 'red' }}>{ errorMessage }</Box> }
                </Box>
        }
    </React.Fragment>
    return enteringKey
        ? <ListItem>
            { contents }
        </ListItem>
        : <ListItemButton onClick={enteringKey ? () => {} : () => {
            setEnteringKey(true)
            setToTarget(true)
            setTarget('')
        }}>
            { contents }
        </ListItemButton>
}

export default AddRoomExit
