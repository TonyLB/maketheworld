import React, { FunctionComponent } from 'react'
import { useDispatch } from 'react-redux'
import { useNavigate } from 'react-router-dom'

import { useTheme } from '@mui/material/styles'
import useMediaQuery from '@mui/material/useMediaQuery'

import {
    Avatar,
    Card,
    CardHeader,
    CardContent,
    CardActions,
    Button,
    Typography,
    IconButton
} from '@mui/material'
import EditIcon from '@mui/icons-material/Edit'
import PreviewIcon from '@mui/icons-material/Preview'

import { socketDispatchPromise } from '../../slices/lifeLine'
import { CharacterAvatarDirect } from '../CharacterAvatar'

import AssetIcon from '@mui/icons-material/Landscape'
import { AssetClientPlayerAsset, AssetClientPlayerCharacter } from '@tonylb/mtw-interfaces/dist/asset'

export type PreviewPaneContents = ({
    type: 'Asset'
} & AssetClientPlayerAsset) | ({
    type: 'Character'
} & AssetClientPlayerCharacter)

type PreviewPaneMeta = {
    clearPreview: () => void;
    personal: boolean;
}

type PreviewPaneProps = PreviewPaneMeta & PreviewPaneContents

const PreviewAsset: FunctionComponent<AssetClientPlayerAsset & PreviewPaneMeta> = ({ personal, clearPreview, AssetId }) => {
    const navigate = useNavigate()
    const dispatch = useDispatch()
    const theme = useTheme()
    const medium = useMediaQuery(theme.breakpoints.up('md'))
    const large = useMediaQuery(theme.breakpoints.up('lg'))
    const portraitSize = large ? 80 : medium ? 70 : 60
    return <Card>
        <CardHeader
            avatar={
                <Avatar sx={{ width: `${portraitSize}px`, height: `${portraitSize}px` }} variant="rounded">
                    <AssetIcon sx={{ width: `${portraitSize*0.7}px`, height: `${portraitSize*0.7}px` }}/>
                </Avatar>
            }
            action={
                <React.Fragment>
                    {
                        personal && 
                        <Button
                            onClick={() => {
                                navigate(`/Library/Edit/Asset/${AssetId}/`)
                            }}
                            aria-label="edit"
                        >
                            <EditIcon />
                            Edit
                        </Button>
                    }
                    <Button
                        onClick={() => {
                            navigate(`/Library/Edit/Asset/${AssetId}/`)
                        }}
                        aria-label="view"
                    >
                        <PreviewIcon />
                        View
                    </Button>
                </React.Fragment>
            }
            title={
                <Typography variant={large ? "h3" : medium ? "h5" : "h6"} component="div" gutterBottom>
                    { AssetId }
                </Typography>
            }
        />
        <CardActions>
            { personal && <Button
                    onClick={() => {
                        dispatch(socketDispatchPromise({ message: 'checkin', AssetId: `ASSET#${AssetId}` }, { service: 'asset' }))
                        clearPreview()
                    }}
                >
                    Check In to Library
                </Button>
            }
            { !personal && <Button
                    onClick={() => {
                        dispatch(socketDispatchPromise({ message: 'checkout', AssetId: `ASSET#${AssetId}` }, { service: 'asset' }))
                        clearPreview()
                    }}
                >
                    Check Out of Library
                </Button>
            }
        </CardActions>
    </Card>
}

const PreviewCharacter: FunctionComponent<AssetClientPlayerCharacter & { personal: boolean, clearPreview: () => void }> = ({ personal, clearPreview, CharacterId, scopedId, Name, fileURL, FirstImpression, Pronouns, OneCoolThing, Outfit }) => {
    const navigate = useNavigate()
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
                personal && 
                    <IconButton
                        onClick={() => {
                            navigate(`/Library/Edit/Character/${scopedId}/`)
                        }}
                        aria-label="edit"
                    >
                        <EditIcon />
                    </IconButton>
            }
            title={
                <Typography variant={large ? "h3" : medium ? "h5" : "h6"} component="div">
                    { Name }
                </Typography>
            }
            subheader={
                <Typography variant="overline" component="div" gutterBottom>
                    { FirstImpression }
                </Typography>
            }
        />
        <CardContent>
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
        </CardContent>
        <CardActions>
            { personal && <Button
                    onClick={() => {
                        dispatch(socketDispatchPromise({ message: 'checkin', AssetId: CharacterId }, { service: 'asset' }))
                        clearPreview()
                    }}
                >
                    Check In to Library
                </Button>
            }
            { !personal && <Button
                    onClick={() => {
                        dispatch(socketDispatchPromise({ message: 'checkout', AssetId: CharacterId }, { service: 'asset' }))
                        clearPreview()
                    }}
                >
                    Check Out of Library
                </Button>
            }
        </CardActions>
    </Card>
}

export const PreviewPane: FunctionComponent<PreviewPaneProps> = (props) => {
    const { type, personal, clearPreview, ...rest } = props
    switch(type) {
        case 'Character':
            return <PreviewCharacter clearPreview={clearPreview} personal={personal} {...rest as AssetClientPlayerCharacter} />
        case 'Asset':
            return <PreviewAsset clearPreview={clearPreview} personal={personal} {...rest as AssetClientPlayerAsset} />
        default:
            return <div>
                Preview Pane
            </div>
    }
}

export default PreviewPane
