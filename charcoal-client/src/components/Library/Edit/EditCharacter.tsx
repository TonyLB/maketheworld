import React, { FunctionComponent, useEffect, useMemo, useCallback, useState } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import {
    Box,
    Grid,
    Stack,
    CircularProgress,
    IconButton,
    TextField,
    Button,
    FormControl,
    InputLabel,
    Select,
    MenuItem
} from '@mui/material'
import TextSnippetIcon from '@mui/icons-material/TextSnippet'
import {
    Routes,
    Route,
    useParams,
    useNavigate
} from "react-router-dom"

import useAutoPin from '../../../slices/UI/navigationTabs/useAutoPin'
import {
    addItem,
    getStatus,
    getWMLQuery
} from '../../../slices/personalAssets'
import { heartbeat } from '../../../slices/stateSeekingMachine/ssmHeartbeat'
import { NormalCharacter, NormalCharacterPronouns } from '../../../wml/normalize'

import WMLEdit from './WMLEdit'
import LibraryBanner from './LibraryBanner'
import LibraryAsset, { useLibraryAsset } from './LibraryAsset'

type CharacterEditPronounsProps = NormalCharacterPronouns & {
}

const standardPronouns: Record<string, NormalCharacterPronouns> = {
    'he/him': {
        subject: 'he',
        object: 'him',
        reflexive: 'himself',
        possessive: 'his',
        adjective: 'his'
    },
    'she/her': {
        subject: 'she',
        object: 'her',
        reflexive: 'herself',
        possessive: 'hers',
        adjective: 'her'
    },
    'it': {
        subject: 'it',
        object: 'it',
        reflexive: 'itself',
        possessive: 'its',
        adjective: 'its'
    },
    'they/them': {
        subject: 'they',
        object: 'them',
        reflexive: 'themself',
        possessive: 'theirs',
        adjective: 'their'
    },
    'ze/zir': {
        subject: 'ze',
        object: 'zir',
        reflexive: 'zirself',
        possessive: 'zirs',
        adjective: 'zir'
    },
    'xe/xem': {
        subject: 'xe',
        object: 'xem',
        reflexive: 'xirself',
        possessive: 'xirs',
        adjective: 'xir'
    },
    'sie/hir': {
        subject: 'sie',
        object: 'hir',
        reflexive: 'hirself',
        possessive: 'hirs',
        adjective: 'hir'
    }
}

const CharacterEditPronouns: FunctionComponent<CharacterEditPronounsProps> = (pronouns) => {
    const [currentPronouns, setCurrentPronouns] = useState<NormalCharacterPronouns>(pronouns)
    const selectValue = useMemo(() => {
        const stringified = JSON.stringify(currentPronouns, Object.keys(currentPronouns).sort())
        return (Object.entries(standardPronouns)
            .find(([_, standard]) => {
                return Boolean(JSON.stringify(standard, Object.keys(currentPronouns).sort()) === stringified)
            })
            ?.[0]) || 'custom'
    }, [currentPronouns])
    const pronounMenuItems = useMemo(() => (
        [
            ...(Object.keys(standardPronouns).map((value) => (
                <MenuItem key={`pronoun-${value}`} value={value}>{ value }</MenuItem>
            ))),
            <MenuItem key='pronoun-custom' value='custom'>custom</MenuItem>
        ]
    ), [])
    return <Box sx={{ paddingTop: '1em' }}>
        <Box
            sx={{
                position: 'relative',
                border: '1px solid grey',
                borderRadius: '5px',
                padding: '1em',
                paddingTop: '1.75em'
            }}
        >
            <FormControl sx={{
                position: 'absolute',
                top: '-1.75em',
                left: '0.25em',
                overflow: 'visible',
                m: 1,
                maxWidth: 120,
                alignContent: 'center',
                justifyContent: 'center',
                zIndex: '1',
                backgroundColor: 'white'
            }} size="small">
                <InputLabel id="pronoun-select">Pronouns</InputLabel>
                <Select
                    labelId="pronoun-select"
                    id="pronoun-select"
                    value={selectValue}
                    label="Pronouns"
                >
                    { pronounMenuItems }
                </Select>
            </FormControl>
            <Grid container spacing={2}>
                <Grid item xs={8} sm={6} md={4}>
                    <TextField
                        required
                        id="pronoun-subject"
                        label="Subject"
                        value={currentPronouns.subject}
                        size="small"
                    />
                </Grid>
                <Grid item xs={8} sm={6} md={4}>
                    <TextField
                        required
                        id="pronoun-object"
                        label="Object"
                        value={currentPronouns.object}
                        size="small"
                    />
                </Grid>
                <Grid item xs={8} sm={6} md={4}>
                    <TextField
                        required
                        id="pronoun-reflexive"
                        label="Reflexive"
                        value={currentPronouns.reflexive}
                        size="small"
                    />
                </Grid>
                <Grid item xs={8} sm={6} md={4}>
                    <TextField
                        required
                        id="pronoun-possessive"
                        label="Possessive"
                        value={currentPronouns.possessive}
                        size="small"
                    />
                </Grid>
                <Grid item xs={8} sm={6} md={4}>
                    <TextField
                        required
                        id="pronoun-adjective"
                        label="Adjective"
                        value={currentPronouns.adjective}
                        size="small"
                    />
                </Grid>

            </Grid>
        </Box>
    </Box>
}


type CharacterEditFormProps = {}

const CharacterEditForm: FunctionComponent<CharacterEditFormProps> = () => {
    const { normalForm, wmlQuery, updateWML, save } = useLibraryAsset()
    const navigate = useNavigate()

    const character = Object.values(normalForm || {}).find(({ tag }) => (['Character'].includes(tag))) as NormalCharacter | undefined
    return <Box sx={{ width: "100%" }}>
        <LibraryBanner
            primary={character?.Name || 'Unnamed'}
            secondary={character?.key || ''}
            commands={
                <IconButton onClick={() => { navigate(`WML`) }}>
                    <TextSnippetIcon />
                </IconButton>
            }
            breadCrumbProps={[{
                    href: '/Library',
                    label: 'Library'
                },
                {
                    label: character?.Name || 'Unnamed'
                }
            ]}
        />
        <Stack sx={{ margin: '1em' }} spacing={2}>
            <TextField
                required
                id="name-field"
                label="Name"
                value={character?.Name || ''}
            />
            <TextField
                required
                id="first-impression-field"
                label="First Impression"
                value={character?.FirstImpression || ''}
            />
            <CharacterEditPronouns {...character?.Pronouns || { subject: '', object: '', reflexive: '', possessive: '', adjective: '' }} />
            <TextField
                id="one-cool-thing-field"
                label="One Cool Thing"
                value={character?.OneCoolThing || ''}
            />
            <TextField
                id="outfit-field"
                label="Outfit"
                value={character?.Outfit || ''}
            />
        </Stack>
        <Button onClick={save}>Save</Button>
    </Box>
}

type EditCharacterProps = {}

export const EditCharacter: FunctionComponent<EditCharacterProps> = () => {

    const { AssetId: assetKey } = useParams<{ AssetId: string }>()
    const AssetId = `CHARACTER#${assetKey}`
    useAutoPin({
        href: `/Library/Edit/Character/${assetKey}`,
        label: `${assetKey}`
    })
    const dispatch = useDispatch()
    useEffect(() => {
        if (assetKey) {
            dispatch(addItem({ key: `CHARACTER#${assetKey}` }))
            dispatch(heartbeat)
        }
    }, [dispatch, assetKey])

    const currentStatus = useSelector(getStatus(AssetId))
    const wmlQuery = useSelector(getWMLQuery(AssetId))

    return (['FRESH', 'DIRTY'].includes(currentStatus || '') && wmlQuery)
        ? 
            <LibraryAsset assetKey={assetKey || ''} character>
                <Routes>
                    <Route path={'WML'} element={<WMLEdit />} />
                    <Route path={''} element={<CharacterEditForm />} />
                </Routes>
            </LibraryAsset>
            
        : <div style={{ height: "100%", width: "100%", display: "flex", alignItems: "center", justifyContent: "center" }}><div><CircularProgress /></div></div>

}

export default EditCharacter
