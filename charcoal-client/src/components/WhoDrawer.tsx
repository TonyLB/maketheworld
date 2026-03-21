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
                    whoIsActive.map(({ CharacterId, DisplayName }) => {
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
                            <TableRow key={CharacterId} hover onClick={() => { }}>
                                <TableCell>
                                    <CharacterAvatar CharacterId={CharacterId} />
                                </TableCell>
                                <TableCell>{ DisplayName.length > 20 ? `${DisplayName.slice(0,17)}...` : DisplayName }</TableCell>
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