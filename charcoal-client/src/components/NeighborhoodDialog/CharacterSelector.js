import React from 'react'
import { useSelector } from 'react-redux'

// MaterialUI imports
import {
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    TableContainer,
    Table,
    TableHead,
    TableBody,
    TableRow,
    TableCell,
    Button
} from '@material-ui/core'

import { getCharactersInPlay } from '../../selectors/charactersInPlay'
import useStyles from '../styles'

export const CharacterSelector = ({ open, onClose, grants = [], addHandler = () => () => {} }) => {
    const charactersInPlay = useSelector(getCharactersInPlay)
    const classes = useStyles()
    return <Dialog
        maxWidth="lg"
        open={open}
        onClose={onClose}
    >
        <DialogTitle id="character-select-dialog-title">Select Character</DialogTitle>
        <DialogContent>
            <TableContainer style={{maxHeight: "400px" }}>
                <Table stickyHeader aria-label="Characters">
                    <TableHead>
                        <TableRow>
                            <TableCell className={classes.lightblue}>
                                Name
                            </TableCell>
                            <TableCell width={300} className={classes.lightblue}>
                                First Impression
                            </TableCell>
                        </TableRow>
                    </TableHead>
                    <TableBody>
                        {
                            Object.entries(charactersInPlay)
                                .filter(([key]) => (!grants.find(({ CharacterId }) => (key === CharacterId))))
                                .filter(([key]) => (key !== 'meta'))
                                .map(([_, { CharacterId, Name, FirstImpression }]) => (
                                    <TableRow
                                        key={CharacterId}
                                        hover
                                        role="nav"
                                        onClick={() => {
                                            addHandler(CharacterId)()
                                            onClose()
                                        }}
                                    >
                                        <TableCell>
                                            { Name }
                                        </TableCell>
                                        <TableCell>
                                            { FirstImpression }
                                        </TableCell>
                                    </TableRow>
                                ))
                        }                        
                    </TableBody>
                </Table>
            </TableContainer>
        </DialogContent>
        <DialogActions>
            <Button onClick={onClose}>
                Cancel
            </Button>
        </DialogActions>
    </Dialog>
}

export default CharacterSelector