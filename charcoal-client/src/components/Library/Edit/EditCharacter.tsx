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
import Autocomplete from '@mui/material/Autocomplete'
import UploadIcon from '@mui/icons-material/Upload'
import TextSnippetIcon from '@mui/icons-material/TextSnippet'
import CheckBoxOutlineBlankIcon from '@mui/icons-material/CheckBoxOutlineBlank'
import CheckBoxIcon from '@mui/icons-material/CheckBox'
import SaveIcon from '@mui/icons-material/Save'
import {
    Routes,
    Route,
    useParams,
    useNavigate
} from "react-router-dom"

import useAutoPin from '../../../slices/UI/navigationTabs/useAutoPin'
import {
    addItem,
    getAll,
    getStatus,
    setIntent,
    setLoadedImage,
} from '../../../slices/personalAssets'
import { heartbeat } from '../../../slices/stateSeekingMachine/ssmHeartbeat'

import WMLEdit from './WMLEdit'
import LibraryBanner from './LibraryBanner'
import LibraryAsset, { useLibraryAsset, useLibraryImageURL } from './LibraryAsset'
import useDebounce from '../../../hooks/useDebounce'
import { CharacterAvatarDirect } from '../../CharacterAvatar'
import FileWrapper, { useFileWrapper } from '../FileInputWrapper'
import { getMyAssets, getMyCharacterByKey } from '../../../slices/player'
import { useOnboardingCheckpoint } from '../../Onboarding/useOnboarding'
import { addOnboardingComplete } from '../../../slices/player/index.api'
import { schemaOutputToString } from '@tonylb/mtw-wml/ts/schema/utils/schemaOutput/schemaOutputToString'
import { AssetClientPlayerCharacter } from '@tonylb/mtw-interfaces/ts/asset'
import { ignoreWrapped } from '@tonylb/mtw-wml/ts/schema/utils'
import { StandardCharacter } from '@tonylb/mtw-wml/ts/standardize/components/character'
import { SchemaOneCoolThingTag, SchemaPronouns, SchemaPronounsTag } from '@tonylb/mtw-base/ts/schema/character'
import { SchemaTag } from '@tonylb/mtw-base/ts/schema'
import { SchemaImageTag } from '@tonylb/mtw-base/ts/schema/image'
import { StandardForm } from '@tonylb/mtw-wml/ts/standardize'

type CharacterEditPronounsProps = Omit<SchemaPronounsTag, 'tag'> & {
    selectValue: string;
    onSelectChange: (selectValue: string) => void;
    onChange: (pronouns: Omit<SchemaPronounsTag, 'tag'>) => void;
}

const standardPronouns: Record<string, Omit<SchemaPronounsTag, 'tag'>> = {
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
    const onChangeFactory = (tag: keyof SchemaPronouns) => (event: { target: { value: string }}) => {
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

const LiteralNameField: FunctionComponent<{ character: StandardCharacter }> = ({ character }) => {
    const { updateStandard } = useLibraryAsset()

    const [currentNameValue, setCurrentNameValue] = useState(() => {
        return schemaOutputToString(ignoreWrapped(character.name)?.children ?? []) || ''
    })

    const debouncedTagValue = useDebounce(currentNameValue, 500)

    useEffect(() => {
        if ((schemaOutputToString(ignoreWrapped(character.name)?.children ?? []) || '') !== debouncedTagValue) {
            updateStandard({
                type: 'update',
                update: (incoming: StandardForm) => {
                    const base = incoming.byId[character.key]
                    if (base instanceof StandardCharacter) {
                        base._payload._name = { data: { tag: 'Name' }, children: [{ data: { tag: 'String', value: debouncedTagValue }, children: []}] }
                    }
                    return incoming
                }
            })
        }
    }, [character.key, character.name, updateStandard, debouncedTagValue])

    return <TextField
        required
        id="name-field"
        label="Name"
        value={currentNameValue}
        onChange={(event) => { setCurrentNameValue(event.target.value) }}
    />

}

interface ImageHeaderProps {
    ItemId: `CHARACTER#${string}`;
    Name: string;
}

const EditCharacterIcon: FunctionComponent<ImageHeaderProps> = ({ ItemId, Name }) => {
    const { standardForm } = useLibraryAsset()
    const { dragActive, openUpload } = useFileWrapper()
    const iconURL = useLibraryImageURL(`${standardForm.key}Icon`)

    return <Box sx={dragActive
        ? {
            borderRadius: '5px',
            borderStyle: 'dashed',
            borderWidth: '2px',
            borderColor: 'lightGrey',
        }
        : {
            padding: '2px'
        }}>
        <Stack direction="row">
            <CharacterAvatarDirect
                CharacterId={ItemId}
                Name={Name ?? ''}
                width="6em"
                height="6em"
                fileURL={iconURL}
            />
            <Stack>
                <Box sx={{ flexGrow:1 }} />
                <IconButton onClick={openUpload}><UploadIcon /></IconButton>
                <Box sx={{ flexGrow:1 }} />
            </Stack>
        </Stack>
    </Box>
}

type CharacterEditFormProps = {}

const CharacterEditForm: FunctionComponent<CharacterEditFormProps> = () => {
    const { updateStandard, standardForm, save, AssetId, status } = useLibraryAsset()
    const navigate = useNavigate()

    const character = useMemo(() => {
        const character = standardForm.byId[standardForm.key]
        if (character instanceof StandardCharacter) {
            return character
        }
        return undefined
    }, [standardForm])

    const currentPronouns = useMemo<Omit<SchemaPronounsTag, 'tag'>>(() => {
        const { tag, ...rest } = ignoreWrapped<SchemaPronounsTag, SchemaTag>(character?.pronouns)?.data ?? { subject: 'they', object: 'them', possessive: 'theirs', adjective: 'their', reflexive: 'themself' }
        return rest
    }, [character])
    const selectValue = useMemo(() => {
        const stringified = JSON.stringify(currentPronouns, Object.keys(currentPronouns).sort())
        return (Object.entries(standardPronouns)
            .find(([_, standard]) => {
                return Boolean(JSON.stringify(standard, Object.keys(currentPronouns).sort()) === stringified)
            })
            ?.[0]) || 'custom'
    }, [currentPronouns])
    const onSelectChangeHandler = useCallback((value) => {
        if (character && ((value !== 'custom') && standardPronouns[value])) {
            updateStandard({
                type: 'update',
                update: (incoming: StandardForm) => {
                    const base = incoming.byId[character.key]
                    if (base instanceof StandardCharacter) {
                        base._payload._pronouns = { data: { tag: 'Pronouns', ...standardPronouns[value] }, children: [] }
                    }
                    return incoming
                }
            })
        }
    }, [character, updateStandard])

    const dispatch = useDispatch()
    const onDrop = useCallback((file: File) => {
        if (character?.key) {
            const characterIconKey = `${character.key}Icon`
            //
            // If an Image exist, but not by the characterIcon default key, use it
            //
            let SCHEMADIRTY = false
            if (ignoreWrapped<SchemaImageTag, SchemaTag>(character?.image)?.data?.key) {
                dispatch(setLoadedImage(AssetId)({ itemId: ignoreWrapped<SchemaImageTag, SchemaTag>(character?.image)?.data?.key, file }))
            }
            //
            // Otherwise, assign to the characterIcon default key, creating an Image tag in the WML if necessary
            //
            else {
                updateStandard({
                    type: 'update',
                    update: (incoming: StandardForm) => {
                        const base = incoming.byId[character.key]
                        if (base instanceof StandardCharacter) {
                            base._payload._image = { data: { tag: 'Image', key: characterIconKey }, children: [] }
                        }
                        return incoming
                    }
                })
                SCHEMADIRTY = true
                dispatch(setLoadedImage(AssetId)({ itemId: characterIconKey, file }))
            }
            dispatch(setIntent({ key: AssetId, intent: SCHEMADIRTY ? ['SCHEMADIRTY'] : ['WMLDIRTY', 'SCHEMADIRTY']}))
            dispatch(heartbeat)
        }
    }, [dispatch, character, updateStandard])
    const saveHandler = useCallback(() => {
        dispatch(addOnboardingComplete(['saveCharacter'], { requireSequence: true }))
        save()
    }, [save])

    if (!character) {
        return <Box sx={{ width: "100%" }} />
    }
    return <Box sx={{ width: "100%" }}>
        <LibraryBanner
            primary={schemaOutputToString(ignoreWrapped(character?.name)?.children ?? []) || 'Unnamed'}
            secondary={character?.key || ''}
            commands={
                <React.Fragment>
                    <Button onClick={saveHandler} disabled={status === 'FRESH'}><SaveIcon />Save</Button>
                    <IconButton onClick={() => { navigate(`WML`) }}>
                        <TextSnippetIcon />
                    </IconButton>
                </React.Fragment>
            }
            breadCrumbProps={[{
                    href: '/Library',
                    label: 'Library'
                },
                {
                    label: schemaOutputToString(ignoreWrapped(character?.name)?.children ?? []) || 'Unnamed'
                }
            ]}
        />
        <Stack sx={{ margin: '1em' }} spacing={2}>
            <Stack spacing={2} direction="row">
                <FileWrapper
                    fileTypes={['image/gif', 'image/jpeg', 'image/png', 'image/bmp', 'image/tiff']}
                    onFile={onDrop}
                >
                    <EditCharacterIcon ItemId={`CHARACTER#${character?.key || '123'}`} Name={schemaOutputToString(ignoreWrapped(character?.name)?.children ?? []) ?? ''} />
                </FileWrapper>
                <Stack spacing={2} sx={{ flexGrow: 1 }}>
                    <LiteralNameField character={character} />
                </Stack>
            </Stack>
            <CharacterEditPronouns
                selectValue={selectValue}
                onSelectChange={onSelectChangeHandler}
                // onChange={setCurrentPronouns}
                onChange={() => {}}
                {...currentPronouns}
            />
            {/* <EditCharacterAssetList /> */}
        </Stack>
    </Box>
}

type EditCharacterProps = {}

export const EditCharacter: FunctionComponent<EditCharacterProps> = () => {

    const { AssetId: assetKey } = useParams<{ AssetId: string }>()

    const character = useSelector(getMyCharacterByKey(assetKey)) as AssetClientPlayerCharacter
    useAutoPin({
        href: `/Library/Edit/Character/${assetKey}`,
        label: `${assetKey}`,
        type: 'LibraryEdit',
        assetId: character?.CharacterId
    })
    useOnboardingCheckpoint('editCharacter', { requireSequence: true })
    const dispatch = useDispatch()
    useEffect(() => {
        if (assetKey) {
            dispatch(addItem({ key: character?.CharacterId }))
            dispatch(heartbeat)
        }
    }, [dispatch, assetKey])

    const currentStatus = useSelector(getStatus(character?.CharacterId))

    return (['FRESH', 'WMLDIRTY', 'SCHEMADIRTY', 'NEEDERROR', 'DRAFTERROR', 'NEEDPARSE', 'PARSEDRAFT'].includes(currentStatus || ''))
        ? 
            <LibraryAsset assetKey={character?.CharacterId?.split('#')?.slice(1)?.[0] || ''} character>
                <Routes>
                    <Route path={'WML'} element={<WMLEdit />} />
                    <Route path={''} element={<CharacterEditForm />} />
                </Routes>
            </LibraryAsset>
            
        : <div style={{ height: "100%", width: "100%", display: "flex", alignItems: "center", justifyContent: "center" }}><div><CircularProgress /></div></div>

}

export default EditCharacter
