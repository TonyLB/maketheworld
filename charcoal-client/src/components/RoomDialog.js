// Foundational imports (React, Redux, etc.)
import React, { useState } from 'react'
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
import { closeRoomDialog } from '../actions/UI/roomDialog'
import { getRoomDialogUI } from '../selectors/UI/roomDialog.js'
import useStyles from './styles'

export const RoomDialog = () => {
    const { open, ...defaultValues } = useSelector(getRoomDialogUI)
    const [formValues, setFormValues] = useState({})
    const dispatch = useDispatch()

    const { name = '', parentId = '', description = '', exits=[], entries=[], parentName='' } = formValues

    const onChangeHandler = (label) => (event) => { setFormValues({ ...formValues, [label]: event.target.value }) }

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
            onEnter={() => { setFormValues(defaultValues) } }
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
                                            onChange={onChangeHandler('name')}
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
                                            onChange={onChangeHandler('description')}
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
                                                            <DeleteForeverIcon />
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
                                                { neighborhoodPaths.map(({ name, exitId, entryId, type, roomName }) => (
                                                    <TableRow key={`${exitId || entryId}`}>
                                                        <TableCell>{name}</TableCell>
                                                        <TableCell>
                                                            { type === 'EXIT' && <ArrowForwardIcon /> }
                                                            { type === 'ENTRY' && <ArrowBackIcon /> }
                                                            <HouseIcon />
                                                        </TableCell>
                                                        <TableCell align="right">{roomName}</TableCell>
                                                        <TableCell align="right">
                                                            <DeleteForeverIcon />
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
                <Button onClick={ () => { dispatch(closeRoomDialog()) } }>
                    Save
                </Button>
            </DialogActions>
        </Dialog>
    )
}

export default RoomDialog