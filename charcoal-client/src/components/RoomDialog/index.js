// Foundational imports (React, Redux, etc.)
import React, { useReducer } from 'react'
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
    Table,
    TableBody,
    TableCell,
    TableContainer,
    TableHead,
    TableRow,
    Grid
} from '@material-ui/core'
import DeleteForeverIcon from '@material-ui/icons/DeleteForever'
import ArrowForwardIcon from '@material-ui/icons/ArrowForward'
import ArrowBackIcon from '@material-ui/icons/ArrowBack'
import HouseIcon from '@material-ui/icons/House'


// Local code imports
import { closeRoomDialog } from '../../actions/UI/roomDialog'
import { putAndCloseRoomDialog } from '../../actions/permanentAdmin'
import { getRoomDialogUI } from '../../selectors/UI/roomDialog.js'
import useStyles from '../styles'

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
        default:
            return state
    }
}

export const RoomDialog = () => {
    const { open, ...defaultValues } = useSelector(getRoomDialogUI)
    const [formValues, formDispatch] = useReducer(roomDialogReducer, {})
    const dispatch = useDispatch()

    const { name = '', parentId = '', description = '', exits=[], entries=[], parentName='' } = formValues

    const onShallowChangeHandler = (label) => (event) => { formDispatch(appearanceUpdate({ label, value: event.target.value })) }
    const onPathDeleteHandler = (type, roomId) => () => {
        formDispatch(type === 'EXIT'
            ? removeExit(roomId)
            : removeEntry(roomId)
        )
    }
    const saveHandler = () => {
        const { name, description, parentId, roomId, exits, entries } = formValues
        const roomData = { name, description, parentId, roomId, exits, entries }
        dispatch(putAndCloseRoomDialog(roomData))
    }

    const paths = [
        ...(exits.map((exit) => ({ type: 'EXIT', ...exit }))),
        ...(entries.map((entry) => ({ type: 'ENTRY', ...entry })))
    ].sort(({ roomId: roomIdA }, { roomId: roomIdB }) => (roomIdA.localeCompare(roomIdB)))

    const neighborhoodPaths = paths.filter(({ parentRoomId }) => (parentRoomId === parentId))
    const externalPaths = paths.filter(({ parentRoomId }) => (parentRoomId !== parentId))

    const classes = useStyles()
    return(
        <Dialog
            maxWidth="lg"
            open={open}
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
                                className={classes.lightblue}
                                titleTypographyProps={{ variant: "overline" }}
                            />
                            <CardContent>
                                { (externalPaths.length &&
                                    <TableContainer>
                                        <Table className={classes.table}>
                                            <TableHead>
                                                <TableRow>
                                                    <TableCell>Name</TableCell>
                                                    <TableCell>To/From</TableCell>
                                                    <TableCell>Neighborhood</TableCell>
                                                    <TableCell align="right">Room</TableCell>
                                                    <TableCell align="right">
                                                        <DeleteForeverIcon />
                                                    </TableCell>
                                                </TableRow>
                                            </TableHead>
                                            <TableBody>
                                                { externalPaths.map(({
                                                        name,
                                                        id,
                                                        type,
                                                        roomId,
                                                        roomName,
                                                        roomParentName
                                                    }) => (
                                                    <TableRow key={`${id}`}>
                                                        <TableCell>{name}</TableCell>
                                                        <TableCell>
                                                            { type === 'EXIT' && <ArrowForwardIcon /> }
                                                            { type === 'ENTRY' && <ArrowBackIcon /> }
                                                            <HouseIcon />
                                                        </TableCell>
                                                        <TableCell>{roomParentName}</TableCell>
                                                        <TableCell align="right">{roomName}</TableCell>
                                                        <TableCell align="right">
                                                            <DeleteForeverIcon onClick={onPathDeleteHandler(type, roomId)} />
                                                        </TableCell>
                                                    </TableRow>
                                                ))}
                                            </TableBody>
                                        </Table>
                                    </TableContainer>
                                    ) || null
                                }

                            </CardContent>
                        </Card>
                    </Grid>
                    <Grid item>
                        <Card className={classes.neighborhoodPathsCard} height={"100%"}>
                            <CardHeader
                                title="Neighborhood paths"
                                className={classes.lightblue}
                                titleTypographyProps={{ variant: "overline" }}
                            />
                            <CardContent>
                                { (neighborhoodPaths.length &&
                                    <TableContainer>
                                        <Table className={classes.table}>
                                            <TableHead>
                                                <TableRow>
                                                    <TableCell>Name</TableCell>
                                                    <TableCell>To/From</TableCell>
                                                    <TableCell align="right">Room</TableCell>
                                                    <TableCell align="right">
                                                        <DeleteForeverIcon />
                                                    </TableCell>
                                                </TableRow>
                                            </TableHead>
                                            <TableBody>
                                                { neighborhoodPaths.map(({ name, exitId, entryId, roomId, type, roomName }) => (
                                                    <TableRow key={`${exitId || entryId}`}>
                                                        <TableCell>{name}</TableCell>
                                                        <TableCell>
                                                            { type === 'EXIT' && <ArrowForwardIcon /> }
                                                            { type === 'ENTRY' && <ArrowBackIcon /> }
                                                            <HouseIcon />
                                                        </TableCell>
                                                        <TableCell align="right">{roomName}</TableCell>
                                                        <TableCell align="right">
                                                            <DeleteForeverIcon onClick={onPathDeleteHandler(type, roomId)} />
                                                        </TableCell>
                                                    </TableRow>
                                                ))}
                                            </TableBody>
                                        </Table>
                                    </TableContainer>
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
    )
}

export default RoomDialog