import React from 'react'
import { useSelector } from 'react-redux'

import {
    Table,
    TableHead,
    TableBody,
    TableRow,
    TableCell
} from '@mui/material'

import { getActiveCharacterList } from '../slices/ephemera'
import CharacterAvatar from './CharacterAvatar'

export const WhoDrawer = () => {
    const whoIsActive = useSelector(getActiveCharacterList)

    return (
        <Table aria-label="who is online">
            <TableHead>
                <TableRow>
                    <TableCell />
                    <TableCell>Character</TableCell>
                    <TableCell>Neighborhood</TableCell>
                </TableRow>
            </TableHead>
            <TableBody>
                {
                    whoIsActive.map(({ CharacterId, Name, fileURL }) => {
                        //
                        // TODO: Figure out how to present a workable room/area name using the new WML Asset
                        // system.
                        //
                        const neighborhoodName = '??????'
                        //
                        // TODO: Create an onClick that presents reasonable options (including a short-cut
                        // some replacement for DirectMessageDialog)
                        //
                        return (
                            <TableRow hover onClick={() => { }}>
                                <TableCell>
                                    <CharacterAvatar CharacterId={CharacterId} />
                                </TableCell>
                                <TableCell>{ Name.length > 20 ? `${Name.slice(0,17)}...` : Name }</TableCell>
                                <TableCell>{ neighborhoodName }</TableCell>
                            </TableRow>
                        )
                    })
                }
            </TableBody>
        </Table>
    )
}

export default WhoDrawer