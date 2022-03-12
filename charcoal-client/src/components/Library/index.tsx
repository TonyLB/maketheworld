import React, { FunctionComponent, useState } from 'react'
import { useSelector } from 'react-redux'
import { useNavigate } from 'react-router-dom'

import {
    Avatar,
    Box,
    Divider,
    Grid,
    List,
    ListItemButton,
    ListItemIcon,
    ListItemText,
    ListSubheader
} from '@mui/material'

import AssetIcon from '@mui/icons-material/Landscape'

import useAutoPin from '../../slices/UI/navigationTabs/useAutoPin'
import { PlayerAsset, PlayerCharacter } from '../../slices/player/baseClasses'
import { getMyCharacters, getMyAssets } from '../../slices/player'
import { CharacterAvatarDirect } from '../CharacterAvatar'

interface TableOfContentsProps {
    Characters: PlayerCharacter[];
    Assets: PlayerAsset[]
}

const TableOfContents: FunctionComponent<TableOfContentsProps> = ({ Characters = [], Assets = [] }) => {
    const [selectedIndex, setSelectedIndex] = React.useState<undefined | number>()
    const handleListItemClick = (event: any, index: number) => {
        setSelectedIndex(index)
    }
    return <List component="nav" aria-label="main mailbox folders">
        { (Assets.length > 0) && <ListSubheader>Assets</ListSubheader> }
        { Assets.map(({ AssetId }, index) => (
            <ListItemButton
                key={AssetId}
                selected={selectedIndex === index}
                onClick={(event) => handleListItemClick(event, index)}
            >
                <ListItemIcon>
                    <Avatar>
                        <AssetIcon />
                    </Avatar>
                </ListItemIcon>
                <ListItemText primary={ AssetId } />
            </ListItemButton>
        ))}
        { (Characters.length > 0) && <ListSubheader>Characters</ListSubheader> }
        { Characters.map(({ CharacterId, Name, fileURL }, index) => (
            <ListItemButton
                key={CharacterId}
                selected={selectedIndex === (index + Assets.length)}
                onClick={(event) => handleListItemClick(event, (index + Assets.length))}
            >
                <ListItemIcon>
                    <CharacterAvatarDirect CharacterId={CharacterId} Name={Name} fileURL={fileURL} />
                </ListItemIcon>
                <ListItemText primary={ Name || CharacterId } />
            </ListItemButton>
        ))}
    </List>
}

interface LibraryProps {

}

export const Library: FunctionComponent<LibraryProps> = () => {
    useAutoPin({ href: `/Library/`, label: `Library`})
    const navigate = useNavigate()
    const Characters = useSelector(getMyCharacters)
    const Assets = useSelector(getMyAssets)

    return <Box sx={{ flexGrow: 1, padding: "10px" }}>
        <div style={{ textAlign: "center" }}>
            <Divider />
            <h2>Personal</h2>
            <Divider />
        </div>
        <Grid
            sx={{ width: "100%", padding: "10px" }}
            container
            direction="row"
            justifyContent="center"
            alignItems="center"
            spacing={3}
        >
            <Grid item xs={6}>
                <TableOfContents Characters={Characters} Assets={Assets} />
            </Grid>
            <Grid item xs={6}>
            </Grid>
        </Grid>
        <div style={{ textAlign: "center" }}>
            <Divider />
            <h2>Public</h2>
            <Divider />
        </div>
        <Grid
            sx={{ width: "100%", padding: "10px" }}
            container
            direction="row"
            justifyContent="space-evenly"
            alignItems="center"
            spacing={3}
        >
        </Grid>
    </Box>
}

export default Library
