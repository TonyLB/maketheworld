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
import { getMyCharacterByKey } from '../../../slices/player'
import { useOnboardingCheckpoint } from '../../Onboarding/useOnboarding'
import { addOnboardingComplete } from '../../../slices/player/index.api'
import { schemaOutputToString } from '@tonylb/mtw-wml/ts/schema/utils/schemaOutput/schemaOutputToString'
import { AssetClientPlayerCharacter } from '@tonylb/mtw-interfaces/ts/asset'
import { ignoreWrapped } from '@tonylb/mtw-wml/ts/schema/utils'
import { StandardCharacter } from '@tonylb/mtw-wml/ts/standardize/components/character'
import { SchemaTag } from '@tonylb/mtw-base/ts/schema'
import { SchemaImageTag } from '@tonylb/mtw-base/ts/schema/image'
import { StandardForm } from '@tonylb/mtw-wml/ts/standardize'
import { StandardLiteral } from '@tonylb/mtw-wml/ts/standardize/literal'

const LiteralShortNameField: FunctionComponent<{ character: StandardCharacter }> = ({ character }) => {
    const { updateStandard } = useLibraryAsset()

    const [currentNameValue, setCurrentNameValue] = useState(() => {
        return character.shortName?._payload.plain.toJSON() || ''
    })

    const debouncedTagValue = useDebounce(currentNameValue, 500)

    useEffect(() => {
        if ((character.shortName?._payload.plain.toJSON() || '') !== debouncedTagValue) {
            updateStandard({
                type: 'update',
                update: (incoming: StandardForm) => {
                    const base = incoming.byId[character.key]
                    if (base instanceof StandardCharacter) {
                        base._payload._shortName = debouncedTagValue ? new StandardLiteral(debouncedTagValue) : undefined
                    }
                    return incoming
                }
            })
        }
    }, [character.key, character.name, updateStandard, debouncedTagValue])

    return <TextField
        required
        id="name-field"
        label="Short Name"
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
    const { updateStandard, standardForm, AssetId, status } = useLibraryAsset()
    const { ComponentId } = useParams<{ ComponentId: string }>()
    const navigate = useNavigate()

    const character = useMemo(() => {
        const character = standardForm.byId[ComponentId ?? '']
        if (character instanceof StandardCharacter) {
            return character
        }
        return undefined
    }, [standardForm, ComponentId])

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
        // save()
    }, [])

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
                    <LiteralShortNameField character={character} />
                </Stack>
            </Stack>
            {/* <EditCharacterAssetList /> */}
        </Stack>
    </Box>
}

type EditCharacterProps = {}

export const EditCharacter: FunctionComponent<EditCharacterProps> = () => {
    const { ComponentId } = useParams<{ ComponentId: string }>()
    const { assetKey, updateStandard, standardForm } = useLibraryAsset()

    const character = useSelector(getMyCharacterByKey(ComponentId)) as AssetClientPlayerCharacter
    useAutoPin({
        href: `/Library/Edit/Character/${ComponentId}`,
        label: `${ComponentId}`,
        type: 'ComponentEdit',
        iconName: 'Room',
        assetId: `ASSET#${assetKey}`,
        componentId: ComponentId || ''
    })
    useOnboardingCheckpoint('editCharacter', { requireSequence: true })

    return <CharacterEditForm />

}

export default EditCharacter
