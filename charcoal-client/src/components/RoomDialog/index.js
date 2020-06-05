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
    IconButton,
    Portal,
    Snackbar
} from '@material-ui/core'
import { Alert } from '@material-ui/lab'
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
import { getRoomUpdateValidator } from '../../selectors/validators'
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
const CLEAR_ERROR = 'CLEAR_ERROR'
const clearError = {
    type: CLEAR_ERROR
}
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
const roomDialogReducer = (validator) => (state, action) => {
    console.log(action)
    let returnVal = state
    switch(action.type) {
        case CLEAR_ERROR:
            return {
                ...state,
                showError: false
            }
        case APPEARANCE_UPDATE:
            returnVal = {
                ...state,
                [action.label]: action.value
            }
            break
        case RESET_FORM_VALUES:
            returnVal = action.defaultValues
            break
        case REMOVE_EXIT:
            returnVal = {
                ...state,
                Exits: state.Exits.filter(exit => (exit.RoomId !== action.RoomId))
            }
            break
        case REMOVE_ENTRY:
            returnVal= {
                ...state,
                Entries: state.Entries.filter(entry => (entry.RoomId !== action.RoomId))
            }
            break
        case UPDATE_EXIT_NAME:
            const findExit = state.Exits.find(exit => (exit.RoomId === action.RoomId))
            const otherExits = state.Exits.filter(exit => (exit.RoomId !== action.RoomId))
            returnVal = {
                ...state,
                Exits: [
                    ...otherExits,
                    {
                        ...findExit,
                        Name: action.Name
                    }
                ]
            }
            break
        case UPDATE_ENTRY_NAME:
            const findEntry = state.Entries.find(entry => (entry.RoomId === action.RoomId))
            const otherEntries = state.Entries.filter(entry => (entry.RoomId !== action.RoomId))
            returnVal= {
                ...state,
                Entries: [
                    ...otherEntries,
                    {
                        ...findEntry,
                        Name: action.Name
                    }
                ]
            }
            break
        case ADD_EXIT:
            if (!state.Exits.find(exit => (exit.RoomId === action.RoomId))) {
                returnVal = {
                    ...state,
                    Exits: [
                        ...state.Exits,
                        {
                            Name: convertNameForExit(action.Name),
                            RoomId: action.RoomId
                        }
                    ]
                }
            }
            else {
                returnVal = state
            }
            break
        case ADD_ENTRY:
            if (!state.Entries.find(entry => (entry.RoomId === action.RoomId))) {
                returnVal = {
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
                returnVal = state
            }
            break
        default:
    }
    const { RoomId: PermanentId, ParentId = '', Exits, Entries } = returnVal
    const validation = validator({ PermanentId, ParentId, Exits, Entries }) || {}
    return {
        ...returnVal,
        showError: Boolean(validation.error),
        error: validation.error
    }

}

export const RoomDialog = ({ nested=false }) => {
    const { open, nestedOpen, ...defaultValues } = useSelector(getRoomDialogUI)
    const roomValidator = useSelector(getRoomUpdateValidator)
    const [formValues, formDispatch] = useReducer(roomDialogReducer(roomValidator), {})

    const permanentHeaders = useSelector(getPermanentHeaders)
    const neighborhoodRooms = useSelector(getNeighborhoodSubtree({
        roomId: defaultValues.RoomId,
        ancestry: permanentHeaders[defaultValues.ParentId].Ancestry || ''
    }))
    const neighborhoodTree = useSelector(getNeighborhoodOnlyTree)
    const externalRooms = useSelector(getExternalTree({
        roomId: defaultValues.RoomId,
        ancestry: permanentHeaders[defaultValues.ParentId].Ancestry || ''
    }))
    const dispatch = useDispatch()
    const [ neighborhoodAddAnchorEl, setNeighborhoodAddAnchorEl ] = useState(null)
    const [ externalAddAnchorEl, setExternalAddAnchorEl ] = useState(null)
    const [ parentSetAnchorEl, setParentSetAnchorEl ] = useState(null)

    const { Name = '', Description = '', Exits=[], Entries=[], ParentId='', error = null, showError = false } = formValues
    const { Name: parentName = '', Ancestry: parentAncestry = '' } = (permanentHeaders && permanentHeaders[ParentId]) || {}

    const onShallowChangeHandler = (label) => (event) => { formDispatch(appearanceUpdate({ label, value: event.target.value })) }
    const onPathDeleteHandler = (type, roomId) => () => {
        formDispatch(type === 'EXIT'
            ? removeExit(roomId)
            : removeEntry(roomId)
        )
    }
    const onPathNameHandler = ({ type, RoomId }) => (event) => {
        formDispatch(type === 'EXIT'
            ? updateExitName(RoomId, event.target.value)
            : updateEntryName(RoomId, event.target.value)
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
    ].sort(({ RoomId: roomIdA }, { RoomId: roomIdB }) => ((roomIdA || '').localeCompare(roomIdB)))

    const neighborhoodPaths = paths.filter(({ RoomId }) => (!parentAncestry || (permanentHeaders[RoomId].Ancestry && permanentHeaders[RoomId].Ancestry.startsWith(parentAncestry))))
    const externalPaths = paths.filter(({ RoomId }) => (!(permanentHeaders[RoomId].Ancestry && permanentHeaders[RoomId].Ancestry.startsWith(parentAncestry))))

    const classes = useStyles()
    return(
        <React.Fragment>
            <Portal>
                <Snackbar open={showError}>
                    <Alert severity="error" onClose={() => { formDispatch(clearError) }}>{error}</Alert>
                </Snackbar>
            </Portal>

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
                neighborhoods={{
                    ROOT: {
                        PermanentId: '',
                        Name: "No parent"
                    },
                    ...neighborhoodTree
                }}
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
                    <Button onClick={ () => {
                        formDispatch(clearError)
                        dispatch(closeRoomDialog())
                    } }>
                        Cancel
                    </Button>
                    <Button onClick={saveHandler} disabled={Boolean(error)}>
                        Save
                    </Button>
                </DialogActions>
            </Dialog>
        </React.Fragment>
    )
}

export default RoomDialog