import React from 'react'
import { useSelector } from 'react-redux'

import {
    Table,
    TableHead,
    TableBody,
    TableRow,
    TableCell,
    Avatar
} from '@mui/material'

import { getActiveCharacterList } from '../slices/ephemera'
import CharacterStyleWrapper from './CharacterStyleWrapper'

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
                    whoIsActive.map(({ CharacterId, Name }) => {
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
                            <CharacterStyleWrapper key={CharacterId} CharacterId={CharacterId}>
                                <TableRow hover onClick={() => { }}>
                                    <TableCell>
                                        <Avatar sx={{ bgcolor: 'primary.main' }} >
                                            { Name[0].toUpperCase() }
                                        </Avatar>
                                    </TableCell>
                                    <TableCell>{ Name.length > 20 ? `${Name.slice(0,17)}...` : Name }</TableCell>
                                    <TableCell>{ neighborhoodName }</TableCell>
                                </TableRow>
                            </CharacterStyleWrapper>
                        )
                    })
                }
            </TableBody>
        </Table>
    )
}

export default WhoDrawer