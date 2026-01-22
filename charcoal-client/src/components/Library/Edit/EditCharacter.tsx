import React, { FunctionComponent, useEffect, useMemo, useCallback, useState } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import {
    Box,
    Stack,
    IconButton,
    TextField,
    Button
} from '@mui/material'
import UploadIcon from '@mui/icons-material/Upload'
import TextSnippetIcon from '@mui/icons-material/TextSnippet'
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
import { unwrapSubject } from '@tonylb/mtw-wml/ts/schema/utils'
import { StandardCharacter } from '@tonylb/mtw-wml/ts/standardize/components/character'
import { SchemaImageTag, isSchemaImage } from '@tonylb/mtw-base/ts/schema/image'
import { treeNodeTypeguard } from '@tonylb/mtw-base/ts/genericTree'
import { StandardForm } from '@tonylb/mtw-wml/ts/standardize'
import { StandardLiteral } from '@tonylb/mtw-wml/ts/standardize/literal'
import { useUniversalKey } from '../../../hooks/useUniversalKey'

const LiteralShortNameField: FunctionComponent<{ character: StandardCharacter }> = ({ character }) => {
    const { updateStandard } = useLibraryAsset()

    const [currentNameValue, setCurrentNameValue] = useState(() => {
        return character.shortName?._payload?.plain?.toJSON() ?? ''
    })

    const debouncedTagValue = useDebounce(currentNameValue, 500)

    useEffect(() => {
        if ((character.shortName?._payload?.plain?.toJSON() ?? '') !== debouncedTagValue) {
            updateStandard({
                type: 'update',
                update: (incoming: StandardForm) => {
                    const base = incoming.byUniversalId[character.universalKey!]
                    if (base instanceof StandardCharacter) {
                        base._payload._shortName = debouncedTagValue ? new StandardLiteral(debouncedTagValue) : undefined
                    }
                    return incoming
                }
            })
        }
    }, [character, updateStandard, debouncedTagValue])

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
    const character = standardForm.byUniversalId[ItemId]
    const characterKey = (character instanceof StandardCharacter && character.key) ? character.key : ''
    const iconURL = useLibraryImageURL(`${characterKey}Icon`)

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
    const navigate = useNavigate()
    const universalKey = useUniversalKey('CHARACTER')

    const character = useMemo(() => {
        if (!universalKey) {
            return undefined
        }
        const character = standardForm.byUniversalId[universalKey]
        if (character instanceof StandardCharacter) {
            return character
        }
        return undefined
    }, [standardForm, universalKey])

    const dispatch = useDispatch()
    const onDrop = useCallback((file: File) => {
        if (character?.key && universalKey) {
            const characterIconKey = `${character.key}Icon`
            //
            // If an Image exist, but not by the characterIcon default key, use it
            //
            let SCHEMADIRTY = false
            const unwrappedImage = unwrapSubject<SchemaImageTag>(character?.image)
            if (unwrappedImage && treeNodeTypeguard(isSchemaImage)(unwrappedImage) && unwrappedImage.data.key) {
                dispatch(setLoadedImage(AssetId)({ itemId: unwrappedImage.data.key, file }))
            }
            //
            // Otherwise, assign to the characterIcon default key, creating an Image tag in the WML if necessary
            //
            else {
                updateStandard({
                    type: 'update',
                    update: (incoming: StandardForm) => {
                        const base = incoming.byUniversalId[universalKey]
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
    }, [dispatch, character, universalKey, updateStandard, AssetId])
    const saveHandler = useCallback(() => {
        dispatch(addOnboardingComplete(['saveCharacter'], { requireSequence: true }))
        // save()
    }, [])

    if (!character) {
        return <Box sx={{ width: "100%" }} />
    }
    return <Box sx={{ width: "100%" }}>
        <LibraryBanner
            primary={character?.shortName?._payload?.plain?.toJSON() || 'Unnamed'}
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
                    label: character?.shortName?._payload?.plain?.toJSON() || 'Unnamed'
                }
            ]}
        />
        <Stack sx={{ margin: '1em' }} spacing={2}>
            <Stack spacing={2} direction="row">
                <FileWrapper
                    fileTypes={['image/gif', 'image/jpeg', 'image/png', 'image/bmp', 'image/tiff']}
                    onFile={onDrop}
                >
                    <EditCharacterIcon ItemId={(universalKey || `CHARACTER#${character?.key || '123'}`) as `CHARACTER#${string}`} Name={(() => {
                        if (!character?.name) return ''
                        const nameNode = character.name as any
                        return schemaOutputToString(nameNode.children || [])
                    })()} />
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
    
    const universalKey = useUniversalKey('CHARACTER')

    const character = useSelector(getMyCharacterByKey(ComponentId)) as AssetClientPlayerCharacter
    useAutoPin({
        href: `/Library/Edit/Asset/${assetKey}/Character/${ComponentId}`,
        label: `${ComponentId}`,
        type: 'ComponentEdit',
        iconName: 'Character',
        assetId: `ASSET#${assetKey}`,
        componentId: universalKey!
    })
    useOnboardingCheckpoint('editCharacter', { requireSequence: true })

    return <CharacterEditForm />

}

export default EditCharacter
