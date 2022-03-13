import React, { FunctionComponent } from 'react'
import { useDispatch } from 'react-redux'

import { useTheme } from '@mui/material/styles'
import useMediaQuery from '@mui/material/useMediaQuery'

import {
    Card,
    CardHeader,
    CardActions,
    Button,
    Typography,
    IconButton
} from '@mui/material'
import EditIcon from '@mui/icons-material/Edit';

import { PlayerAsset, PlayerCharacter } from '../../slices/player/baseClasses'
import { socketDispatchPromise } from '../../slices/lifeLine'
import { CharacterAvatarDirect } from '../CharacterAvatar'

export type PreviewPaneContents = ({
    type: 'Asset'
} & PlayerAsset) | ({
    type: 'Character'
} & PlayerCharacter)

type PreviewPaneProps = {
    personal: boolean;
} & PreviewPaneContents

const PreviewCharacter: FunctionComponent<PlayerCharacter & { personal: boolean }> = ({ personal, CharacterId, Name, fileURL }) => {
    const dispatch = useDispatch()
    const theme = useTheme()
    const medium = useMediaQuery(theme.breakpoints.up('md'))
    const large = useMediaQuery(theme.breakpoints.up('lg'))
    const portraitSize = large ? 80 : medium ? 70 : 60
    return <Card>
        <CardHeader
            avatar={
                <CharacterAvatarDirect
                    CharacterId={CharacterId}
                    Name={Name}
                    fileURL={fileURL}
                    width={`${portraitSize}px`}
                    height={`${portraitSize}px`}
                />    
            }
            action={
                <IconButton aria-label="edit">
                    <EditIcon />
                </IconButton>
            }
            title={
                <Typography variant={large ? "h3" : medium ? "h5" : "h6"} component="div" gutterBottom>
                    { Name }
                </Typography>
            }
        />
        <CardActions>
            { personal && <Button
                    onClick={() => { /* dispatch(socketDispatchPromise('checkin')({ AssetId: `CHARACTER#${CharacterId}` })) */ }}
                >
                    Check In to Library
                </Button>
            }
            { !personal && <Button
                    onClick={() => { /* dispatch(socketDispatchPromise('checkout')({ AssetId: `CHARACTER#${CharacterId}` })) */ }}
                >
                    Check Out of Library
                </Button>
            }
        </CardActions>
    </Card>
}

export const PreviewPane: FunctionComponent<PreviewPaneProps> = (props) => {
    const { type, personal, ...rest } = props
    switch(type) {
        case 'Character':
            return <PreviewCharacter personal={personal} {...rest as PlayerCharacter} />
        default:
            return <div>
                Preview Pane
            </div>
    }
}

export default PreviewPane
