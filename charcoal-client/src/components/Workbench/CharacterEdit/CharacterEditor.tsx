import React, { FunctionComponent, useEffect, useMemo, useCallback, useState } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import {
    Box,
    Stack,
    IconButton,
    TextField,
    Button,
    Card,
    CardHeader,
    CardContent
} from '@mui/material'
import UploadIcon from '@mui/icons-material/Upload'
import SaveIcon from '@mui/icons-material/Save'
import ArrowBackIcon from '@mui/icons-material/ArrowBack'

import {
    setIntent,
    setLoadedImage,
} from '../../../slices/personalAssets'
import { heartbeat } from '../../../slices/stateSeekingMachine/ssmHeartbeat'

import { useWorkbenchAsset } from '../foundations/useWorkbenchAsset'
import { getCurrentComponentId, navigateViaBreadcrumbIndex } from '../../../slices/UI/workbench'
import useDebounce from '../../../hooks/useDebounce'
import { CharacterAvatarDirect } from '../../CharacterAvatar'
import FileWrapper, { useFileWrapper } from '../../Editor/FileInputWrapper'
import { useOnboardingCheckpoint } from '../../Onboarding/useOnboarding'
import { addOnboardingComplete } from '../../../slices/player/index.api'
import { schemaOutputToString } from '@tonylb/mtw-wml/ts/schema/utils/schemaOutput/schemaOutputToString'
import { unwrapSubject } from '@tonylb/mtw-wml/ts/schema/utils'
import { StandardCharacter } from '@tonylb/mtw-wml/ts/standardize/components/character'
import { SchemaImageTag, isSchemaImage } from '@tonylb/mtw-base/ts/schema/image'
import { treeNodeTypeguard } from '@tonylb/mtw-base/ts/genericTree'
import { StandardForm } from '@tonylb/mtw-wml/ts/standardize'
import { StandardLiteral } from '@tonylb/mtw-wml/ts/standardize/literal'
import { ComponentUUID } from '@tonylb/mtw-base/ts/schema'
import { useLibraryImageURL } from '../foundations/useWorkbenchAsset'

const LiteralShortNameField: FunctionComponent<{ character: StandardCharacter }> = ({ character }) => {
    const { updateStandard } = useWorkbenchAsset()

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
    const { standardForm } = useWorkbenchAsset()
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

export const CharacterEditor: FunctionComponent = () => {
    const dispatch = useDispatch()
    const { updateStandard, standardForm, AssetId, status } = useWorkbenchAsset()
    const currentComponentId = useSelector(getCurrentComponentId)

    // Derive universalKey from currentComponentId
    const universalKey = useMemo<ComponentUUID | undefined>(() => {
        if (!currentComponentId) return undefined
        return currentComponentId as ComponentUUID
    }, [currentComponentId])

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

    const onDrop = useCallback((file: File) => {
        if (character?.key && universalKey) {
            const characterIconKey = `${character.key}Icon`
            const unwrappedImage = unwrapSubject<SchemaImageTag>(character?.image)
            if (unwrappedImage && treeNodeTypeguard(isSchemaImage)(unwrappedImage) && unwrappedImage.data.key) {
                dispatch(setLoadedImage(AssetId)({ itemId: unwrappedImage.data.key, file }))
            }
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
                dispatch(setLoadedImage(AssetId)({ itemId: characterIconKey, file }))
            }
            dispatch(setIntent({ key: AssetId, intent: ['SCHEMADIRTY'] }))
            dispatch(heartbeat)
        }
    }, [dispatch, character, universalKey, updateStandard, AssetId])

    const saveHandler = useCallback(() => {
        dispatch(addOnboardingComplete(['saveCharacter'], { requireSequence: true }))
    }, [dispatch])

    const handleBackToAsset = useCallback(() => {
        dispatch(navigateViaBreadcrumbIndex(0))
    }, [dispatch])

    useOnboardingCheckpoint('editCharacter', { requireSequence: true })

    if (!character) {
        return <Box sx={{ width: "100%" }} />
    }

    return (
        <Box sx={{ width: "100%", display: 'flex', flexDirection: 'column', flexGrow: 1 }}>
            <Box sx={{ padding: 2, borderBottom: 1, borderColor: 'divider', display: 'flex', alignItems: 'center', gap: 2 }}>
                <Button
                    startIcon={<ArrowBackIcon />}
                    onClick={handleBackToAsset}
                    variant="outlined"
                    size="small"
                >
                    Back to Asset
                </Button>
                <Box sx={{ flex: 1 }}>
                    <Box sx={{ fontWeight: 'bold', fontSize: '1.125rem' }}>
                        {character?.shortName?._payload?.plain?.toJSON() || 'Unnamed'}
                    </Box>
                    {character?.key && (
                        <Box sx={{ fontSize: '0.875rem', color: 'text.secondary' }}>
                            {character.key}
                        </Box>
                    )}
                </Box>
                <Button onClick={saveHandler} disabled={status === 'FRESH'} startIcon={<SaveIcon />}>
                    Save
                </Button>
            </Box>

            <Box sx={{ flexGrow: 1, overflowY: 'auto', padding: 2 }}>
                <Card>
                    <CardHeader title="Character Details" />
                    <CardContent>
                        <Stack spacing={2}>
                            <Stack spacing={2} direction="row">
                                <FileWrapper
                                    fileTypes={['image/gif', 'image/jpeg', 'image/png', 'image/bmp', 'image/tiff']}
                                    onFile={onDrop}
                                >
                                    <EditCharacterIcon ItemId={(universalKey || `CHARACTER#${character?.key || '123'}`) as `CHARACTER#${string}`} Name={(() => {
                                        if (!character?.displayName) return ''
                                        const nameNode = character.displayName as any
                                        return schemaOutputToString(nameNode.children || [])
                                    })()} />
                                </FileWrapper>
                                <Stack spacing={2} sx={{ flexGrow: 1 }}>
                                    <LiteralShortNameField character={character} />
                                </Stack>
                            </Stack>
                        </Stack>
                    </CardContent>
                </Card>
            </Box>
        </Box>
    )
}

export default CharacterEditor
