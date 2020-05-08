import React, { useState } from 'react'
import { useSelector } from 'react-redux'

// MaterialUI imports
import {
    TableContainer,
    Table,
    TableHead,
    TableBody,
    TableRow,
    TableCell,
    Select,
    FormControl,
    Input,
    MenuItem,
    Chip,
    IconButton
} from '@material-ui/core'
import DeleteIcon from '@material-ui/icons/Delete';

import useStyles from '../styles'
import { getCharactersInPlay } from '../../selectors/charactersInPlay'
import { getRoles } from '../../selectors/role.js'
import CharacterSelector from './CharacterSelector'

const GrantTable = ({ grants = [], changeHandler = () => {}, addHandler = () => () => {}, deleteHandler = () => () => {} }) => {
    const classes = useStyles()
    const [characterSelectorOpen, setCharacterSelectorOpen] = useState(false)
    const charactersInPlay = useSelector(getCharactersInPlay)
    const roles = useSelector(getRoles)
    const columns = [{
        id: 'Name',
        label: 'Character',
        minWidth: 170,
    },
    {
        id: 'Roles',
        label: 'Roles',
        minWidth: 170
    }]
    const rows = grants
        .sort(({ CharacterId: IdA = '' }, { CharacterId: IdB = '' }) => (IdA.localeCompare(IdB)))
        .map(({ CharacterId, ...rest }) => ({
            CharacterId,
            Name: charactersInPlay && charactersInPlay[CharacterId] && charactersInPlay[CharacterId].Name,
            ...rest
        }))
        .filter(({ Name }) => (Name))
    return <React.Fragment>
        <CharacterSelector
            open={characterSelectorOpen}
            onClose={() => { setCharacterSelectorOpen(false) }}
            addHandler={addHandler}
            grants={grants}
        />
        <TableContainer>
            <Table stickyHeader aria-label="Grants">
                <TableHead>
                    <TableRow>
                        { columns.map((column) => (
                            <TableCell
                                key={column.id}
                                align={column.align}
                                style={{ minWidth: column.minWidth }}
                            >
                                {column.label}
                            </TableCell>
                        ))}
                        <TableCell />
                    </TableRow>
                </TableHead>
                <TableBody>
                    { rows.map((row) => (
                        <TableRow hover role="nav" tabIndex={-1} key={row.CharacterId}>
                            {columns.map((column) => {
                                const value = row[column.id];
                                return (
                                    <TableCell key={column.id} align={column.align}>
                                        { column.id === 'Roles'
                                            ? <FormControl>
                                                <Select
                                                    label-id="role-label"
                                                    id="role"
                                                    multiple
                                                    displayEmpty
                                                    value={value.split(',').map((role) => (role.trim())).filter((role) => (role))}
                                                    onChange={changeHandler(row.CharacterId)}
                                                    input={<Input id="role" />}
                                                    placeholder="Roles"
                                                    renderValue={(selected) => {
                                                        if (selected.length === 0) {
                                                            return <em>Roles</em>
                                                        }
                                                        return <div className={classes.chips}>
                                                            {selected.map((value) => (
                                                                <Chip key={value} label={roles && roles[value] && roles[value].Name} className={classes.chip} />
                                                            ))}
                                                        </div>
                                                    }}
                                                >
                                                    { Object.entries(roles).map(([key, { Name }]) => (
                                                        <MenuItem key={key} value={key}>
                                                            { Name }
                                                        </MenuItem>
                                                    )) }
                                                </Select>
                                            </FormControl>
                                            : value
                                        }
                                    </TableCell>
                                )
                            })}
                            <TableCell>
                                <IconButton onClick={deleteHandler(row.CharacterId)}>
                                    <DeleteIcon />
                                </IconButton>
                            </TableCell>
                        </TableRow>
                    ))}
                    <TableRow hover role="nav" tabIndex={-1} key="AddGrant" onClick={() => { setCharacterSelectorOpen(true) }}>
                        <TableCell key="add" align="center" colSpan={3}>
                            Add Grant
                        </TableCell>
                    </TableRow>
                </TableBody>
            </Table>
        </TableContainer>
    </React.Fragment>
}

export default GrantTable