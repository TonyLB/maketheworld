// Foundational imports (React, Redux, etc.)
import React, { useReducer, useState } from 'react'
import { useDispatch, useSelector } from 'react-redux'

// MaterialUI imports
import {
    Card,
    CardHeader,
    CardContent,
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    Button,
    TextField,
    Grid,
    IconButton
} from '@material-ui/core'
import AddBoxIcon from '@material-ui/icons/AddBox'


// Local code imports
import { closeRoomDialog } from '../../actions/UI/roomDialog'
import { putAndCloseRoomDialog } from '../../actions/permanentAdmin'
import { getRoomDialogUI } from '../../selectors/UI/roomDialog.js'
import { getNeighborhoodSubtree, getExternalTree } from '../../selectors/neighborhoodTree'
import useStyles from '../styles'
import ExitList from './ExitList'
import RoomSelectPopover from './RoomSelectPopover'

const RESET_FORM_VALUES = 'RESET_FORM_VALUES'
const resetFormValues = (defaultValues) => ({
    type: RESET_FORM_VALUES,
    defaultValues
})
const APPEARANCE_UPDATE = 'APPEARANCE_UPDATE'
const appearanceUpdate = ({ label, value }) => ({
    type: APPEARANCE_UPDATE,
    label,
    value
})
const REMOVE_EXIT = 'REMOVE_EXIT'
const removeExit = (roomId) => ({
    type: REMOVE_EXIT,
    roomId
})
const REMOVE_ENTRY = 'REMOVE_ENTRY'
const removeEntry = (roomId) => ({
    type: REMOVE_ENTRY,
    roomId
})
const UPDATE_EXIT_NAME = 'UPDATE_EXIT_NAME'
const updateExitName = (roomId, name) => ({
    type: UPDATE_EXIT_NAME,
    roomId,
    name
})
const UPDATE_ENTRY_NAME = 'UPDATE_ENTRY_NAME'
const updateEntryName = (roomId, name) => ({
    type: UPDATE_ENTRY_NAME,
    roomId,
    name
})
const ADD_EXIT = 'ADD_EXIT'
const addExit = ({ roomId, roomName, roomParentId, roomParentName, roomAncestry }) => ({
    type: ADD_EXIT,
    roomId,
    roomName,
    roomParentId,
    roomParentName,
    roomAncestry
})
const ADD_ENTRY = 'ADD_ENTRY'
const addEntry = ({ roomId, roomName, roomParentId, roomParentName, roomAncestry }) => ({
    type: ADD_ENTRY,
    roomId,
    roomName,
    roomParentId,
    roomParentName,
    roomAncestry
})
const roomDialogReducer = (state, action) => {
    switch(action.type) {
        case APPEARANCE_UPDATE:
            return {
                ...state,
                [action.label]: action.value
            }
        case RESET_FORM_VALUES:
            return action.defaultValues
        case REMOVE_EXIT:
            return {
                ...state,
                exits: state.exits.filter(exit => (exit.roomId !== action.roomId))
            }
        case REMOVE_ENTRY:
            return {
                ...state,
                entries: state.entries.filter(entry => (entry.roomId !== action.roomId))
            }
        case UPDATE_EXIT_NAME:
            const findExit = state.exits.find(exit => (exit.roomId === action.roomId))
            const otherExits = state.exits.filter(exit => (exit.roomId !== action.roomId))
            return {
                ...state,
                exits: [
                    ...otherExits,
                    {
                        ...findExit,
                        name: action.name
                    }
                ]
            }
        case UPDATE_ENTRY_NAME:
            const findEntry = state.entries.find(entry => (entry.roomId === action.roomId))
            const otherEntries = state.entries.filter(entry => (entry.roomId !== action.roomId))
            return {
                ...state,
                entries: [
                    ...otherEntries,
                    {
                        ...findEntry,
                        name: action.name
                    }
                ]
            }
        case ADD_EXIT:
            if (!state.exits.find(exit => (exit.roomId === action.roomId))) {
                return {
                    ...state,
                    exits: [
                        ...state.exits,
                        {
                            name: '',
                            id: '',
                            roomId: action.roomId,
                            roomName: action.roomName,
                            roomParentId: action.roomParentId,
                            roomParentName: action.roomParentName,
                            roomAncestry: action.roomAncestry
                        }
                    ]
                }
            }
            else {
                return state
            }
        case ADD_ENTRY:
            if (!state.entries.find(entry => (entry.roomId === action.roomId))) {
                return {
                    ...state,
                    entries: [
                        ...state.entries,
                        {
                            name: '',
                            id: '',
                            roomId: action.roomId,
                            roomName: action.roomName,
                            roomParentId: action.roomParentId,
                            roomParentName: action.roomParentName,
                            roomAncestry: action.roomAncestry
                        }
                    ]
                }
            }
            else {
                return state
            }
        default:
            return state
    }
}

export const RoomDialog = ({ nested=false }) => {
    const { open, nestedOpen, ...defaultValues } = useSelector(getRoomDialogUI)
    const [formValues, formDispatch] = useReducer(roomDialogReducer, {})
    const neighborhoodRooms = useSelector(getNeighborhoodSubtree({
        roomId: defaultValues.roomId,
        ancestry: defaultValues.ancestry
    }))
    const externalRooms = useSelector(getExternalTree({
        roomId: defaultValues.roomId,
        ancestry: defaultValues.ancestry
    }))
    const dispatch = useDispatch()
    const [ neighborhoodAddAnchorEl, setNeighborhoodAddAnchorEl ] = useState(null)
    const [ externalAddAnchorEl, setExternalAddAnchorEl ] = useState(null)

    const { name = '', description = '', exits=[], entries=[], parentName='' } = formValues

    const onShallowChangeHandler = (label) => (event) => { formDispatch(appearanceUpdate({ label, value: event.target.value })) }
    const onPathDeleteHandler = (type, roomId) => () => {
        formDispatch(type === 'EXIT'
            ? removeExit(roomId)
            : removeEntry(roomId)
        )
    }
    const onPathNameHandler = ({ type, roomId }) => (event) => {
        formDispatch(type === 'EXIT'
            ? updateExitName(roomId, event.target.value)
            : updateEntryName(roomId, event.target.value)
        )
    }
    const onPathAddHandler = ({ roomId, roomName, roomParentId, roomParentName, roomAncestry }) => () => {
        formDispatch(addExit({ roomId, roomName, roomParentId, roomParentName, roomAncestry }))
        formDispatch(addEntry({ roomId, roomName, roomParentId, roomParentName, roomAncestry }))
        setNeighborhoodAddAnchorEl(null)
        setExternalAddAnchorEl(null)
    }
    const saveHandler = () => {
        const { name, description, parentId, roomId, exits, entries, parentAncestry } = formValues
        const roomData = { name, description, parentId, roomId, exits, entries, parentAncestry }
        dispatch(putAndCloseRoomDialog(roomData))
    }

    const paths = [
        ...(exits.map((exit) => ({ type: 'EXIT', ...exit }))),
        ...(entries.map((entry) => ({ type: 'ENTRY', ...entry })))
    ].sort(({ roomId: roomIdA }, { roomId: roomIdB }) => (roomIdA.localeCompare(roomIdB)))
    const parentAncestry = defaultValues.ancestry && defaultValues.ancestry.split(':').slice(0, -1).join(':')

    const neighborhoodPaths = paths.filter(({ roomAncestry }) => (roomAncestry.startsWith(parentAncestry)))
    const externalPaths = paths.filter(({ roomAncestry }) => (!roomAncestry.startsWith(parentAncestry)))

    const classes = useStyles()
    return(
        <React.Fragment>
            <RoomSelectPopover
                anchorEl={neighborhoodAddAnchorEl}
                open={Boolean(neighborhoodAddAnchorEl)}
                onClose={() => { setNeighborhoodAddAnchorEl(null) }}
                neighborhoods={neighborhoodRooms}
                addHandler={onPathAddHandler}
            />
            <RoomSelectPopover
                anchorEl={externalAddAnchorEl}
                open={Boolean(externalAddAnchorEl)}
                onClose={() => { setExternalAddAnchorEl(null) }}
                neighborhoods={externalRooms}
                addHandler={onPathAddHandler}
            />
            <Dialog
                maxWidth="lg"
                open={(nested ? nestedOpen : open) || false}
                onEnter={() => { formDispatch(resetFormValues(defaultValues)) } }
            >
                <DialogTitle id="room-dialog-title">Room Edit</DialogTitle>
                <DialogContent>
                    <Grid container>
                        <Grid item>
                            <Card className={classes.card} >
                                <CardHeader
                                    title="Appearance"
                                    className={classes.lightblue}
                                    titleTypographyProps={{ variant: "overline" }}
                                />
                                <CardContent>
                                    <form className={classes.root} noValidate autoComplete="off">
                                        <div>
                                            <TextField
                                                required
                                                id="name"
                                                label="Name"
                                                value={name}
                                                onChange={onShallowChangeHandler('name')}
                                            />
                                            <TextField
                                                disabled
                                                id="neighborhood"
                                                label="Neighborhood"
                                                value={parentName}
                                            />
                                        </div>
                                        <div>
                                            <TextField
                                                required
                                                id="description"
                                                label="Description"
                                                value={description}
                                                multiline
                                                rows={3}
                                                fullWidth
                                                onChange={onShallowChangeHandler('description')}
                                            />
                                        </div>
                                    </form>
                                </CardContent>
                            </Card>
                            <Card className={classes.card} >
                                <CardHeader
                                    title="External paths"
                                    action={<IconButton
                                        aria-label="add external path"
                                        onClick={(event) => { setExternalAddAnchorEl(event.target) }}
                                    >
                                        <AddBoxIcon />
                                    </IconButton>}
                                    className={classes.lightblue}
                                    titleTypographyProps={{ variant: "overline" }}
                                />
                                <CardContent>
                                    {
                                        (externalPaths.length &&
                                            <ExitList
                                                paths={externalPaths}
                                                deleteHandler={onPathDeleteHandler}
                                                nameHandler={onPathNameHandler}
                                            />
                                        ) || null
                                    }
                                </CardContent>
                            </Card>
                        </Grid>
                        <Grid item>
                            <Card className={classes.neighborhoodPathsCard} height={"100%"}>
                                <CardHeader
                                    title="Neighborhood paths"
                                    action={<IconButton
                                        aria-label="add external path"
                                        onClick={(event) => { setNeighborhoodAddAnchorEl(event.target) }}
                                    >
                                        <AddBoxIcon />
                                    </IconButton>}
                                    className={classes.lightblue}
                                    titleTypographyProps={{ variant: "overline" }}
                                />
                                <CardContent>
                                    {
                                        (neighborhoodPaths.length &&
                                            <ExitList
                                                paths={neighborhoodPaths}
                                                deleteHandler={onPathDeleteHandler}
                                                nameHandler={onPathNameHandler}
                                            />
                                        ) || null
                                    }
                                </CardContent>
                            </Card>
                        </Grid>
                    </Grid>
                </DialogContent>
                <DialogActions>
                    <Button onClick={ () => { dispatch(closeRoomDialog()) } }>
                        Cancel
                    </Button>
                    <Button onClick={saveHandler}>
                        Save
                    </Button>
                </DialogActions>
            </Dialog>
        </React.Fragment>
    )
}

export default RoomDialog