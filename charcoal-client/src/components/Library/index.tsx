import React, { FunctionComponent, useEffect } from 'react'
import { useSelector, useDispatch } from 'react-redux'
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
import { getLibrary, setIntent } from '../../slices/library'
import { heartbeat } from '../../slices/stateSeekingMachine/ssmHeartbeat'

import { CharacterAvatarDirect } from '../CharacterAvatar'
import PreviewPane, { PreviewPaneContents } from './PreviewPane'


interface TableOfContentsProps {
    Characters: PlayerCharacter[];
    Assets: PlayerAsset[];
    selectItem: (index: number) => void;
    selectedIndex?: number;
    setPreviewItem: (item: undefined | PreviewPaneContents) => void;
}

const TableOfContents: FunctionComponent<TableOfContentsProps> = ({ Characters = [], Assets = [], selectItem = () => {}, selectedIndex, setPreviewItem = () => {} }) => {
    const handleListItemClick = (event: any, index: number) => {
        selectItem(index)
        if (index >= Assets.length) {
            if ((index - Assets.length) < Characters.length) {
                setPreviewItem({
                    type: 'Character',
                    ...Characters[index-Assets.length]
                })
            }
        }
        else {
            setPreviewItem({
                type: 'Asset',
                ...Assets[index]
            })
        }
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
                    <Avatar variant="rounded">
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
    const dispatch = useDispatch()
    useEffect(() => {
        dispatch(setIntent('CONNECTED'))
        dispatch(heartbeat)
    }, [])
    const [selectedPersonalIndex, setSelectedPersonalIndex] = React.useState<undefined | number>()
    const [personalPreviewItem, setPersonalPreviewItem] = React.useState<undefined | PreviewPaneContents>()
    const clearPersonalPreview = () => {
        setSelectedPersonalIndex(undefined)
        setPersonalPreviewItem(undefined)
    }
    const [selectedLibraryIndex, setSelectedLibraryIndex] = React.useState<undefined | number>()
    const [libraryPreviewItem, setLibraryPreviewItem] = React.useState<undefined | PreviewPaneContents>()
    const clearLibraryPreview = () => {
        setSelectedLibraryIndex(undefined)
        setLibraryPreviewItem(undefined)
    }
    useAutoPin({ href: `/Library/`, label: `Library`})
    const navigate = useNavigate()
    const Characters = useSelector(getMyCharacters)
    const Assets = useSelector(getMyAssets)
    const { Characters: libraryCharacters, Assets: libraryAssets } = useSelector(getLibrary)

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
                <TableOfContents
                    Characters={Characters}
                    Assets={Assets}
                    selectItem={setSelectedPersonalIndex}
                    selectedIndex={selectedPersonalIndex}
                    setPreviewItem={setPersonalPreviewItem}
                />
            </Grid>
            <Grid item xs={6}>
                { personalPreviewItem &&
                    <PreviewPane
                        clearPreview={clearPersonalPreview}
                        personal={true}
                        {...personalPreviewItem}
                    />
                }
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
            <Grid item xs={6}>
                <TableOfContents
                    Characters={libraryCharacters}
                    Assets={libraryAssets}
                    selectItem={setSelectedLibraryIndex}
                    selectedIndex={selectedLibraryIndex}
                    setPreviewItem={setLibraryPreviewItem}
                />
            </Grid>
            <Grid item xs={6}>
            { libraryPreviewItem &&
                    <PreviewPane
                        clearPreview={clearLibraryPreview}
                        personal={false}
                        {...libraryPreviewItem}
                    />
                }
            </Grid>
        </Grid>
    </Box>
}

export default Library
