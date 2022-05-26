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
    SelectChangeEvent,
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
import { WMLQuery } from '../../../wml/wmlQuery'

import WMLEdit from './WMLEdit'
import LibraryBanner from './LibraryBanner'
import LibraryAsset, { useLibraryAsset } from './LibraryAsset'
import useDebounce from '../../../hooks/useDebounce'

type ReplaceLiteralTagProps = {
    wmlQuery: WMLQuery;
    search: string;
    tag: string;
    replace: string;
}

const replaceLiteralTag = ({
    wmlQuery,
    search,
    tag,
    replace
}: ReplaceLiteralTagProps) => {
    //
    // TODO: Add replace method to WMLQuery, to replace the entire tag
    // with new text
    //
    const queryBase = wmlQuery.search(search)
    const queryResult = queryBase.extend().add(tag)
    if (replace) {
        if (queryResult.nodes().length) {
            queryResult.contents(replace)
        }
        else {
            queryBase.addElement(`<${tag}>${replace}</${tag}>`, { position: 'after' })
        }    
    }
    else {
        queryResult.remove()
    }
}

type CharacterEditPronounsProps = NormalCharacterPronouns & {
    selectValue: string;
    onSelectChange: (selectValue: string) => void;
    onChange: (pronouns: NormalCharacterPronouns) => void;
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

const CharacterEditPronouns: FunctionComponent<CharacterEditPronounsProps> = ({
    selectValue,
    onSelectChange,
    onChange,
    ...pronouns
}) => {
    const pronounMenuItems = useMemo(() => (
        [
            ...(Object.keys(standardPronouns).map((value) => (
                <MenuItem key={`pronoun-${value}`} value={value}>{ value }</MenuItem>
            ))),
            <MenuItem key='pronoun-custom' value='custom'>custom</MenuItem>
        ]
    ), [])
    const onChangeFactory = (tag: keyof NormalCharacterPronouns) => (event: { target: { value: string }}) => {
        onChange({ ...pronouns, [tag]: event.target.value })
    }
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
                    onChange={(event) => { onSelectChange(event.target.value) }}
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
                        value={pronouns.subject}
                        size="small"
                        disabled={selectValue !== 'custom'}
                        onChange={onChangeFactory('subject')}
                    />
                </Grid>
                <Grid item xs={8} sm={6} md={4}>
                    <TextField
                        required
                        id="pronoun-object"
                        label="Object"
                        value={pronouns.object}
                        size="small"
                        disabled={selectValue !== 'custom'}
                        onChange={onChangeFactory('object')}
                    />
                </Grid>
                <Grid item xs={8} sm={6} md={4}>
                    <TextField
                        required
                        id="pronoun-reflexive"
                        label="Reflexive"
                        value={pronouns.reflexive}
                        size="small"
                        disabled={selectValue !== 'custom'}
                        onChange={onChangeFactory('reflexive')}
                    />
                </Grid>
                <Grid item xs={8} sm={6} md={4}>
                    <TextField
                        required
                        id="pronoun-possessive"
                        label="Possessive"
                        value={pronouns.possessive}
                        size="small"
                        disabled={selectValue !== 'custom'}
                        onChange={onChangeFactory('possessive')}
                    />
                </Grid>
                <Grid item xs={8} sm={6} md={4}>
                    <TextField
                        required
                        id="pronoun-adjective"
                        label="Adjective"
                        value={pronouns.adjective}
                        size="small"
                        disabled={selectValue !== 'custom'}
                        onChange={onChangeFactory('adjective')}
                    />
                </Grid>

            </Grid>
        </Box>
    </Box>
}

type LiteralTagFieldProps = {
    required?: boolean;
    tag: keyof Omit<NormalCharacter, 'Pronouns'>;
    label: string;
}

const LiteralTagField: FunctionComponent<LiteralTagFieldProps> = ({ required, tag, label }) => {
    const { normalForm, wmlQuery, updateWML } = useLibraryAsset()

    const [currentTagValue, setCurrentTagValue] = useState(() => {
        const character = Object.values(normalForm || {}).find(({ tag }) => (['Character'].includes(tag))) as NormalCharacter | undefined
        return character?.[tag] || ''
    })

    const debouncedTagValue = useDebounce(currentTagValue, 500)

    useEffect(() => {
        replaceLiteralTag({
            wmlQuery,
            search: 'Character',
            tag,
            replace: debouncedTagValue
        })
        updateWML(wmlQuery.source)
    }, [wmlQuery, updateWML, tag, debouncedTagValue])

    return <TextField
        required={required}
        id={`${tag.toLowerCase()}-field`}
        label={label}
        value={currentTagValue}
        onChange={(event) => { setCurrentTagValue(event.target.value) }}
    />

}

type CharacterEditFormProps = {}

const CharacterEditForm: FunctionComponent<CharacterEditFormProps> = () => {
    const { normalForm, wmlQuery, updateWML, save } = useLibraryAsset()
    const navigate = useNavigate()

    const character = Object.values(normalForm || {}).find(({ tag }) => (['Character'].includes(tag))) as NormalCharacter | undefined

    const [currentPronouns, setCurrentPronouns] = useState<NormalCharacterPronouns>(
        character?.Pronouns || {
            subject: '',
            object: '',
            reflexive: '',
            possessive: '',
            adjective: ''
        }
    )
    const [selectValue, setSelectValue] = useState(() => {
        const stringified = JSON.stringify(currentPronouns, Object.keys(currentPronouns).sort())
        return (Object.entries(standardPronouns)
            .find(([_, standard]) => {
                return Boolean(JSON.stringify(standard, Object.keys(currentPronouns).sort()) === stringified)
            })
            ?.[0]) || 'custom'
    })
    const onSelectChangeHandler = useCallback((value) => {
        if ((value !== 'custom') && standardPronouns[value]) {
            setCurrentPronouns(standardPronouns[value])
        }
        setSelectValue(value)
    }, [setCurrentPronouns, setSelectValue])

    const debouncedPronouns = useDebounce(currentPronouns, 500)

    useEffect(() => {
        wmlQuery.search('Character Pronouns')
            .prop('subject', debouncedPronouns.subject)
            .prop('object', debouncedPronouns.object)
            .prop('reflexive', debouncedPronouns.reflexive)
            .prop('possessive', debouncedPronouns.possessive)
            .prop('adjective', debouncedPronouns.adjective)
        updateWML(wmlQuery.source)
    }, [wmlQuery, updateWML, debouncedPronouns])

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
            <LiteralTagField
                required
                tag='Name'
                label="Name"
            />
            <LiteralTagField
                required
                tag="FirstImpression"
                label="First Impression"
            />
            <CharacterEditPronouns
                selectValue={selectValue}
                onSelectChange={onSelectChangeHandler}
                onChange={setCurrentPronouns}
                {...currentPronouns}
            />
            <LiteralTagField
                tag="OneCoolThing"
                label="One Cool Thing"
            />
            <LiteralTagField
                tag="Outfit"
                label="Outfit"
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
