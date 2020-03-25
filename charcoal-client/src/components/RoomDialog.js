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
} from '@material-ui/core'
import DeleteForeverIcon from '@material-ui/icons/DeleteForever'
import ArrowForwardIcon from '@material-ui/icons/ArrowForward'
import HouseIcon from '@material-ui/icons/House'


// Local code imports
import { closeRoomDialog } from '../actions/UI/roomDialog'
import { getRoomDialogUI } from '../selectors/UI/roomDialog.js'
import useStyles from './styles'

export const RoomDialog = () => {
    const { open, ...defaultValues } = useSelector(getRoomDialogUI)
    const [formValues, setFormValues] = useState({})
    const dispatch = useDispatch()

    const { name = '', neighborhood = '', description = '', exits=[] } = formValues

    const onChangeHandler = (label) => (event) => { setFormValues({ ...formValues, [label]: event.target.value }) }

    const classes = useStyles()
    return(
        <Dialog
            maxWidth="lg"
            open={open}
            onEnter={() => { setFormValues(defaultValues) } }
        >
            <DialogTitle id="room-dialog-title">Room Edit</DialogTitle>
            <DialogContent>
                <form className={classes.root} noValidate autoComplete="off">
                    <Card className={classes.card} >
                        <CardHeader
                            title="Appearance"
                            className={classes.lightblue}
                            titleTypographyProps={{ variant: "overline" }}
                        />
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
                                value={neighborhood}
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
                    </Card>
                </form>
                <Card className={classes.card} >
                    <CardHeader
                        title="Neighborhood paths"
                        className={classes.lightblue}
                        titleTypographyProps={{ variant: "overline" }}
                    />
                    <CardContent>
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
                                    { exits.map(({ exitName, toRoomId }) => (
                                        <TableRow>
                                            <TableCell>{exitName}</TableCell>
                                            <TableCell><ArrowForwardIcon /><HouseIcon /></TableCell>
                                            <TableCell align="right">{toRoomId}</TableCell>
                                            <TableCell align="right">
                                                <DeleteForeverIcon />
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </TableContainer>
                    </CardContent>
                </Card>
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