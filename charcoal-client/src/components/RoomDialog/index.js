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
import NeighborhoodIcon from '@material-ui/icons/LocationCity'


// Local code imports
import { closeRoomDialog } from '../../actions/UI/roomDialog'
import { putAndCloseRoomDialog } from '../../actions/permanentAdmin'
import { getRoomDialogUI } from '../../selectors/UI/roomDialog.js'
import {
    getPermanentHeaders,
    getNeighborhoodOnlyTree,
    getNeighborhoodSubtree,
    getExternalTree
} from '../../selectors/permanentHeaders.js'
import useStyles from '../styles'
import ExitList from '../ExitList'
import PermanentSelectPopover from './PermanentSelectPopover'

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
const removeExit = (RoomId) => ({
    type: REMOVE_EXIT,
    RoomId
})
const REMOVE_ENTRY = 'REMOVE_ENTRY'
const removeEntry = (RoomId) => ({
    type: REMOVE_ENTRY,
    RoomId
})
const UPDATE_EXIT_NAME = 'UPDATE_EXIT_NAME'
const updateExitName = (RoomId, Name) => ({
    type: UPDATE_EXIT_NAME,
    RoomId,
    Name
})
const UPDATE_ENTRY_NAME = 'UPDATE_ENTRY_NAME'
const updateEntryName = (RoomId, Name) => ({
    type: UPDATE_ENTRY_NAME,
    RoomId,
    Name
})
const ADD_EXIT = 'ADD_EXIT'
const addExit = (RoomId, Name) => ({
    type: ADD_EXIT,
    RoomId,
    Name
})
const ADD_ENTRY = 'ADD_ENTRY'
const addEntry = (RoomId, Name) => ({
    type: ADD_ENTRY,
    RoomId,
    Name
})

const convertNameForExit = (name) => {
    const re = /^(?:(?:the|an)\s)*(.*)$/i
    const match = re.exec(name)
    return (match ? match[1] : name).toLocaleLowerCase()
}
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
                Exits: state.Exits.filter(exit => (exit.RoomId !== action.RoomId))
            }
        case REMOVE_ENTRY:
            return {
                ...state,
                Entries: state.Entries.filter(entry => (entry.RoomId !== action.RoomId))
            }
        case UPDATE_EXIT_NAME:
            const findExit = state.Exits.find(exit => (exit.RoomId === action.RoomId))
            const otherExits = state.Exits.filter(exit => (exit.RoomId !== action.RoomId))
            return {
                ...state,
                Exits: [
                    ...otherExits,
                    {
                        ...findExit,
                        Name: action.Name
                    }
                ]
            }
        case UPDATE_ENTRY_NAME:
            const findEntry = state.Entries.find(entry => (entry.RoomId === action.RoomId))
            const otherEntries = state.Entries.filter(entry => (entry.RoomId !== action.RoomId))
            return {
                ...state,
                Entries: [
                    ...otherEntries,
                    {
                        ...findEntry,
                        Name: action.Name
                    }
                ]
            }
        case ADD_EXIT:
            if (!state.Exits.find(exit => (exit.roomId === action.roomId))) {
                return {
                    ...state,
                    Exits: [
                        ...state.Exits,
                        {
                            Name: convertNameForExit(action.Name),
                            id: '',
                            RoomId: action.RoomId
                        }
                    ]
                }
            }
            else {
                return state
            }
        case ADD_ENTRY:
            if (!state.Entries.find(entry => (entry.RoomId === action.RoomId))) {
                return {
                    ...state,
                    Entries: [
                        ...state.Entries,
                        {
                            Name: convertNameForExit(action.Name),
                            RoomId: action.RoomId
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
    const neighborhoodTree = useSelector(getNeighborhoodOnlyTree)
    const externalRooms = useSelector(getExternalTree({
        roomId: defaultValues.roomId,
        ancestry: defaultValues.ancestry
    }))
    const permanentHeaders = useSelector(getPermanentHeaders)
    const dispatch = useDispatch()
    const [ neighborhoodAddAnchorEl, setNeighborhoodAddAnchorEl ] = useState(null)
    const [ externalAddAnchorEl, setExternalAddAnchorEl ] = useState(null)
    const [ parentSetAnchorEl, setParentSetAnchorEl ] = useState(null)

    const { Name = '', Description = '', Exits=[], Entries=[], ParentId='' } = formValues
    const { Name: parentName = '', Ancestry: parentAncestry = '' } = (permanentHeaders && permanentHeaders[ParentId]) || {}

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
    const onPathAddHandler = (roomId, exitName) => () => {
        formDispatch(addExit(roomId, exitName))
        formDispatch(addEntry(roomId, Name))
        setNeighborhoodAddAnchorEl(null)
        setExternalAddAnchorEl(null)
    }
    const onSetParentHandler = (neighborhoodId) => () => {
        formDispatch(appearanceUpdate({ label: 'ParentId', value: neighborhoodId }))
        setParentSetAnchorEl(null)
    }
    const saveHandler = () => {
        const { Name, Description, ParentId, RoomId, Exits, Entries } = formValues
        dispatch(putAndCloseRoomDialog({
            RoomId,
            ParentId,
            Name,
            Description,
            Exits: Exits.map(({ Ancestry, ...rest }) => (rest)),
            Entries
        }))
    }

    const paths = [
        ...(Exits.map((exit) => ({ type: 'EXIT', ...exit }))),
        ...(Entries.map((entry) => ({ type: 'ENTRY', ...entry })))
    ].sort(({ RoomId: roomIdA }, { RoomId: roomIdB }) => (roomIdA.localeCompare(roomIdB)))

    const neighborhoodPaths = paths.filter(({ roomId }) => (!parentAncestry || (permanentHeaders && permanentHeaders[roomId] && permanentHeaders[roomId].Ancestry && permanentHeaders[roomId].Ancestry.startsWith(parentAncestry))))
    const externalPaths = paths.filter(({ roomId }) => (!(permanentHeaders && permanentHeaders[roomId] && permanentHeaders[roomId].Ancestry && permanentHeaders[roomId].Ancestry.startsWith(parentAncestry))))

    const classes = useStyles()
    return(
        <React.Fragment>
            <PermanentSelectPopover
                anchorEl={neighborhoodAddAnchorEl}
                open={Boolean(neighborhoodAddAnchorEl)}
                onClose={() => { setNeighborhoodAddAnchorEl(null) }}
                neighborhoods={neighborhoodRooms}
                addHandler={onPathAddHandler}
            />
            <PermanentSelectPopover
                anchorEl={externalAddAnchorEl}
                open={Boolean(externalAddAnchorEl)}
                onClose={() => { setExternalAddAnchorEl(null) }}
                neighborhoods={externalRooms}
                addHandler={onPathAddHandler}
            />
            <PermanentSelectPopover
                anchorEl={parentSetAnchorEl}
                open={Boolean(parentSetAnchorEl)}
                onClose={() => { setParentSetAnchorEl(null) }}
                neighborhoods={neighborhoodTree}
                selectableNeighborhoods
                addHandler={onSetParentHandler}
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
                                                id="Name"
                                                label="Name"
                                                value={Name}
                                                onChange={onShallowChangeHandler('Name')}
                                            />
                                            <TextField
                                                disabled
                                                id="neighborhood"
                                                label="Neighborhood"
                                                value={parentName}
                                            />
                                            <IconButton onClick={(event) => { setParentSetAnchorEl(event.target) }}>
                                                <NeighborhoodIcon />
                                            </IconButton>
                                        </div>
                                        <div>
                                            <TextField
                                                required
                                                id="Description"
                                                label="Description"
                                                value={Description}
                                                multiline
                                                rows={3}
                                                fullWidth
                                                onChange={onShallowChangeHandler('Description')}
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