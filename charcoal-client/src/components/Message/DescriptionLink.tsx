/** @jsxImportSource @emotion/react */
import React, { ReactChild, ReactChildren } from 'react'
import { useDispatch } from 'react-redux'
import { css } from '@emotion/react'

import {
    Box,
    Chip,
    Typography,
    Divider
} from '@mui/material'
import { blue } from '@mui/material/colors'

import {
    RoomDescribeLink
} from '../../slices/messages/baseClasses'

import { socketDispatchPromise } from '../../slices/lifeLine'
import { useActiveCharacter } from '../ActiveCharacter'

interface DescriptionLinkProps {
    link: RoomDescribeLink
}

export const DescriptionLink = ({ link }: DescriptionLinkProps) => {
    const { CharacterId } = useActiveCharacter()
    const dispatch = useDispatch()
    switch(link.targetTag) {
        case 'Action':
            return <Chip
                sx={{
                    background: `linear-gradient(${blue[400]}, ${blue[600]})`,
                    color: 'white',
                    '&:hover': {
                        background: `linear-gradient(${blue[500]}, ${blue[700]})`,
                    }
                }}
                size="small"
                onClick={() => {
                    dispatch(socketDispatchPromise('link')({
                        targetTag: 'Action',
                        Action: link.toAction,
                        AssetId: link.toAssetId,
                        RoomId: link.RoomId,
                        CharacterId
                    }))
                }}
                label={link.text}
            />
        case 'Feature':
            return <Box
                component="span"
                sx={{
                    background: `linear-gradient(${blue[200]}, ${blue[300]})`,
                    borderRadius: 0,
                    borderLeft: `solid ${blue[400]} 3px`,
                    paddingBottom: '5px',
                    cursor: 'pointer',
                    '&:hover': {
                        background: `linear-gradient(${blue[300]}, ${blue[400]})`,
                    }
                }}
                onClick={() => {
                    dispatch(socketDispatchPromise('link')({
                        targetTag: 'Feature',
                        FeatureId: link.toFeatureId,
                        RoomId: link.RoomId,
                        CharacterId
                    }))
                }}
            >
                { link.text }
            </Box>
    }
}

export default DescriptionLink
