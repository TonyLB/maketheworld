/** @jsxImportSource @emotion/react */
import React, { ReactChild, ReactChildren } from 'react'
import { css } from '@emotion/react'
import { useTheme } from '@mui/material/styles'
import useMediaQuery from '@mui/material/useMediaQuery'


import {
    Box,
    Typography,
    Divider
} from '@mui/material'
import { blue, grey } from '@mui/material/colors'
import FeatureIcon from '@mui/icons-material/Search'

import MessageComponent from './MessageComponent'
import { CharacterAvatarDirect } from '../CharacterAvatar'
import {
    CharacterDescription as CharacterDescriptionType
} from '../../slices/messages/baseClasses'

import DescriptionLink from './DescriptionLink'

interface CharacterDescriptionProps {
    message: CharacterDescriptionType;
    children?: ReactChild | ReactChildren;
}

export const CharacterDescription = ({ message }: CharacterDescriptionProps) => {
    const theme = useTheme()
    const medium = useMediaQuery(theme.breakpoints.up('md'))
    const large = useMediaQuery(theme.breakpoints.up('lg'))
    const portraitSize = large ? 160 : medium ? 120 : 80
    const { CharacterId, Name, fileURL } = message
    return <MessageComponent
            sx={{
                paddingTop: "10px",
                paddingBottom: "10px",
                marginRight: "75px",
                marginLeft: "75px",
                background: `linear-gradient(${grey[100]}, ${grey[300]})`,
                borderRadius: '20px',
                color: (theme) => (theme.palette.getContrastText(blue[200]))
            }}
            leftIcon={
                <CharacterAvatarDirect
                    CharacterId={CharacterId}
                    Name={Name}
                    fileURL={fileURL}
                    width={`${portraitSize}px`}
                    height={`${portraitSize}px`}
                />
            }
            leftGutter={portraitSize + 20}
        >
            <Box css={css`
                grid-area: content;
                padding-bottom: 5px;
            `}>
                <Typography variant='h5' align='left'>
                    { Name }
                </Typography>
                <Divider />
            </Box>
        </MessageComponent>
}

export default CharacterDescription
