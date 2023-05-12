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

import MessageComponent from './MessageComponent'
import { CharacterAvatarDirect } from '../CharacterAvatar'
import {
    CharacterDescription as CharacterDescriptionType
} from '@tonylb/mtw-interfaces/dist/messages'

interface CharacterDescriptionProps {
    message: CharacterDescriptionType;
    children?: ReactChild | ReactChildren;
}

export const CharacterDescription = ({ message }: CharacterDescriptionProps) => {
    const theme = useTheme()
    const medium = useMediaQuery(theme.breakpoints.up('md'))
    const large = useMediaQuery(theme.breakpoints.up('lg'))
    const portraitSize = large ? 160 : medium ? 120 : 80
    const { CharacterId, Name, fileURL, FirstImpression, Pronouns, OneCoolThing, Outfit } = message

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
                <Typography variant='overline' align='left'>
                    { FirstImpression }
                </Typography>
                <Divider />
                <Typography variant='body1' align='left'>
                    {
                        (Pronouns?.subject && Pronouns?.object) &&
                        (<React.Fragment>
                            <b>Pronouns: </b> { Pronouns?.subject[0]?.toUpperCase()}{ Pronouns?.subject?.slice(1) }/{Pronouns?.object}
                        </React.Fragment>) 
                    }
                </Typography>
                <Typography variant='body1' align='left'>
                    {
                        OneCoolThing &&
                        (<React.Fragment>
                            <b>One Cool Thing{ Pronouns?.object && <React.Fragment> about { Pronouns?.object }</React.Fragment>}: </b> { OneCoolThing }
                        </React.Fragment>) 
                    }
                </Typography>
                <Typography variant='body1' align='left'>
                    {
                        Outfit &&
                        (<React.Fragment>
                            <b>Outfit: </b> { Outfit }
                        </React.Fragment>) 
                    }
                </Typography>
            </Box>
        </MessageComponent>
}

export default CharacterDescription
