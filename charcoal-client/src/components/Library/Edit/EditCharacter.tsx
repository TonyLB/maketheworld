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
import { isNormalImage, isNormalImport, NormalCharacter, NormalCharacterPronouns } from '@tonylb/mtw-wml/dist/normalize/baseClasses'

import WMLEdit from './WMLEdit'
import LibraryBanner from './LibraryBanner'
import LibraryAsset, { useLibraryAsset, useLibraryImageURL } from './LibraryAsset'
import useDebounce from '../../../hooks/useDebounce'
import { CharacterAvatarDirect } from '../../CharacterAvatar'
import FileWrapper, { useFileWrapper } from '../FileInputWrapper'
import { UpdateSchemaPayload } from '../../../slices/personalAssets/reducers'
import { SchemaCharacterTag, SchemaPronounsTag, SchemaTag, isSchemaCharacter, isSchemaImport } from '@tonylb/mtw-wml/dist/simpleSchema/baseClasses'
import { deepEqual } from '../../../lib/objects'
import Checkbox from '@mui/material/Checkbox'
import { getLibrary } from '../../../slices/library'
import { getMyAssets } from '../../../slices/player'
import { useOnboardingCheckpoint } from '../../Onboarding/useOnboarding'
import { addOnboardingComplete } from '../../../slices/player/index.api'
import { GenericTree, GenericTreeNode, GenericTreeNodeFiltered, TreeId } from '@tonylb/mtw-wml/dist/sequence/tree/baseClasses'

type ReplaceLiteralTagProps = {
    schema: GenericTree<SchemaTag, TreeId>;
    updateSchema: (action: UpdateSchemaPayload) => void;
    tag: LiteralTagFieldProps["tag"];
    replace: string;
}

const characterFromSchema = (schema: GenericTree<SchemaTag, TreeId>): SchemaCharacterTag => {
    if (schema.length === 0) {
        throw new Error('No character asset in EditCharacter')
    }
    const baseSchema = schema[0].data
    if (!isSchemaCharacter(baseSchema)) {
        throw new Error('Non-character asset in EditCharacter')
    }
    return baseSchema
}

const specificChildFromSchema = (schema: GenericTree<SchemaTag, TreeId>, tag: SchemaTag["tag"]): GenericTreeNodeFiltered<Extract<SchemaTag, { tag: typeof tag }>, SchemaTag, TreeId> | undefined => {
    if (schema.length === 0) {
        throw new Error('No character asset in EditCharacter')
    }
    const children = schema[0].children
    const validTags = children.filter((node): node is GenericTreeNodeFiltered<Extract<SchemaTag, { tag: typeof tag }>, SchemaTag, TreeId> => (
        node.data.tag === tag
    ))
    return validTags.length ? validTags[0] : undefined
}

const replaceLiteralTag = ({
    schema,
    updateSchema,
    tag,
    replace
}: ReplaceLiteralTagProps) => {
    const mergeProperty = (merge: Partial<SchemaCharacterTag>) => {
        const baseSchema = characterFromSchema(schema)
        const updatedSchema = { ...baseSchema, ...merge } as SchemaCharacterTag
        if (!deepEqual(baseSchema, updatedSchema)) {
            updateSchema({
                type: 'replace',
                id: schema[0].id,
                item: { data: updatedSchema, children: [] },
            })    
        }
    }
    switch(tag) {
        case 'FirstImpression':
            mergeProperty({ FirstImpression: replace || undefined })
            break
        case 'Name':
            mergeProperty({ Name: replace || undefined })
            break
        case 'OneCoolThing':
            mergeProperty({ OneCoolThing: replace || undefined })
            break
        case 'Outfit':
            mergeProperty({ Outfit: replace || undefined })
            break
    }
}

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
    tag: 'FirstImpression' | 'Outfit' | 'OneCoolThing' | 'Name';
    label: string;
}

const LiteralTagField: FunctionComponent<LiteralTagFieldProps> = ({ required, tag, label }) => {
    const { schema, updateSchema } = useLibraryAsset()

    const [currentTagValue, setCurrentTagValue] = useState(() => {
        const character = schema[0].data
        return character?.[tag] || ''
    })

    const debouncedTagValue = useDebounce(currentTagValue, 500)

    useEffect(() => {
        replaceLiteralTag({
            schema,
            updateSchema,
            tag,
            replace: debouncedTagValue
        })
    }, [schema, updateSchema, tag, debouncedTagValue])

    return <TextField
        required={required}
        id={`${tag.toLowerCase()}-field`}
        label={label}
        value={currentTagValue}
        onChange={(event) => { setCurrentTagValue(event.target.value) }}
    />

}

type EditCharacterAssetListProps = {}

type ZonedAssets = {
    key: string;
    zone: string;
}

const EditCharacterAssetList: FunctionComponent<EditCharacterAssetListProps> = () => {
    const { Assets: libraryAssets } = useSelector(getLibrary)
    const personalAssets = useSelector(getMyAssets)
    const allPersonalAssets = useSelector(getAll)
    const assetsAvailable: ZonedAssets[] = [
        ...personalAssets
            .filter(({ AssetId }) => ((`ASSET#${AssetId}` in allPersonalAssets && allPersonalAssets[`ASSET#${AssetId}`].serialized) || !(`ASSET#${AssetId}` in allPersonalAssets)))
            .map(({ AssetId }) => ({ key: AssetId, zone: 'Personal' })),
        ...libraryAssets.map(({ AssetId }) => ({ key: AssetId, zone: 'Library' }))
    ]
    const { schema, updateSchema, normalForm } = useLibraryAsset()
    const [assetsImported, setAssetsImported] = useState(Object.values(normalForm)
        .filter(isNormalImport)
        .map(({ from }) => (from))
        //
        // TODO: Find each asset in the Library and determine its zone
        //
        .map((key) => (assetsAvailable.find(({ key: checkKey }) => (key === checkKey))))
        .filter((value) => (value))
    )
    const dispatch = useDispatch()
    const onChange = useCallback((_, newAssets) => {
        const saveableAssets = newAssets.filter((item): item is { key: string; zone: string } => (typeof item === 'object'))
        setAssetsImported(saveableAssets)
        const baseSchema = characterFromSchema(schema)
        const updateChildren = [
            ...schema[0].children.filter(({ data }) => (!isSchemaImport(data))),
            ...saveableAssets.map(({ key }) => ({ data: { tag: 'Import', from: key }, children: [] }))
        ]
        updateSchema({
            type: 'replace',
            id: schema[0].id,
            item: { data: baseSchema, children: updateChildren }
        })
        if (saveableAssets.filter((item) => (typeof item === 'object' && 'zone' in item && item.zone === 'Personal')).length) {
            dispatch(addOnboardingComplete(['editCharacterAssets']))
        }
    }, [setAssetsImported, schema, updateSchema, dispatch])
    return <Autocomplete
        multiple
        id="asset-list"
        options={assetsAvailable}
        groupBy={({ zone }) => (zone)}
        disableCloseOnSelect
        getOptionLabel={(option) => (((typeof option === 'object') && option.key) || ((typeof option === 'string') && option))}
        isOptionEqualToValue={({ key: keyA }, { key: keyB }) => (keyA === keyB)}
        renderOption={(props, option, { selected }) => (
            <li {...props}>
            <Checkbox
                icon={<CheckBoxOutlineBlankIcon fontSize="small" />}
                checkedIcon={<CheckBoxIcon fontSize="small" />}
                style={{ marginRight: 8 }}
                checked={selected}
            />
            {option.key}
            </li>
        )}
        style={{ width: 500 }}
        renderInput={(params) => (
            <TextField {...params} label="View Non-Canon Assets" />
        )}
        value={assetsImported}
        onChange={onChange}
    />
}

interface ImageHeaderProps {
    ItemId: `CHARACTER#${string}`;
    Name: string;
    characterKey: string;
}

const EditCharacterIcon: FunctionComponent<ImageHeaderProps> = ({ ItemId, Name, characterKey }) => {
    const { dragActive, openUpload } = useFileWrapper()
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
    const { schema, updateSchema, normalForm, updateNormal, save, AssetId, status } = useLibraryAsset()
    const navigate = useNavigate()

    const character = characterFromSchema(schema)

    const [currentPronouns, setCurrentPronouns] = useState<Omit<SchemaPronounsTag, 'tag'>>(
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
        const baseSchema = characterFromSchema(schema)
        if (!deepEqual(baseSchema.Pronouns, debouncedPronouns)) {
            const pronounTag = specificChildFromSchema(schema, 'Pronouns')
            if (pronounTag) {
                updateSchema({
                    type: 'replace',
                    id: pronounTag.id,
                    item: { data: { tag: 'Pronouns' as const, ...debouncedPronouns }, children: [] }
                })
            }
        }
    }, [schema, updateSchema, debouncedPronouns])

    const dispatch = useDispatch()
    const onDrop = useCallback((file: File) => {
        if (character?.key) {
            const characterIconKey = `${character.key}Icon`
            const unconditionedImages = Object.values(normalForm)
                .filter(isNormalImage)
                .filter(({ appearances }) => (appearances.find(({ contextStack }) => (!contextStack.find(({ tag }) => (tag === 'If'))))))
            //
            // If Images exist, but not by the characterIcon default key, choose the first at random
            //
            let normalDirty = false
            if (unconditionedImages.length && !unconditionedImages.find(({ key }) => (key === characterIconKey))) {
                dispatch(setLoadedImage(AssetId)({ itemId: unconditionedImages[0].key, file }))
            }
            //
            // Otherwise, assign to the characterIcon default key, creating an Image tag in the WML if necessary
            //
            else {
                if (!unconditionedImages.length) {
                    updateSchema({
                        type: 'addChild',
                        id: schema[0].id,
                        item: { data: { tag: 'Image', key: characterIconKey }, children: [] }
                    })
                    normalDirty = true
                }
                dispatch(setLoadedImage(AssetId)({ itemId: characterIconKey, file }))
            }
            dispatch(setIntent({ key: AssetId, intent: normalDirty ? ['NORMALDIRTY'] : ['WMLDIRTY', 'NORMALDIRTY']}))
            dispatch(heartbeat)
        }
    }, [dispatch, character?.key, schema, updateSchema, normalForm])
    const saveHandler = useCallback(() => {
        dispatch(addOnboardingComplete(['saveCharacter'], { requireSequence: true }))
        save()
    }, [save])

    return <Box sx={{ width: "100%" }}>
        <LibraryBanner
            primary={character?.Name || 'Unnamed'}
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
                    label: character?.Name || 'Unnamed'
                }
            ]}
        />
        <Stack sx={{ margin: '1em' }} spacing={2}>
            <Stack spacing={2} direction="row">
                <FileWrapper
                    fileTypes={['image/gif', 'image/jpeg', 'image/png', 'image/bmp', 'image/tiff']}
                    onFile={onDrop}
                >
                    <EditCharacterIcon ItemId={`CHARACTER#${character?.key || '123'}`} Name={character?.Name ?? ''} characterKey={character?.key ?? ''} />
                </FileWrapper>
                <Stack spacing={2} sx={{ flexGrow: 1 }}>
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
                </Stack>
            </Stack>
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
            <EditCharacterAssetList />
        </Stack>
    </Box>
}

type EditCharacterProps = {}

export const EditCharacter: FunctionComponent<EditCharacterProps> = () => {

    const { AssetId: assetKey } = useParams<{ AssetId: string }>()
    const AssetId = `CHARACTER#${assetKey}` as const
    useAutoPin({
        href: `/Library/Edit/Character/${assetKey}`,
        label: `${assetKey}`,
        type: 'LibraryEdit',
        assetId: AssetId
    })
    useOnboardingCheckpoint('editCharacter', { requireSequence: true })
    const dispatch = useDispatch()
    useEffect(() => {
        if (assetKey) {
            dispatch(addItem({ key: `CHARACTER#${assetKey}` }))
            dispatch(heartbeat)
        }
    }, [dispatch, assetKey])

    const currentStatus = useSelector(getStatus(AssetId))

    return (['FRESH', 'WMLDIRTY', 'NORMALDIRTY', 'NEEDERROR', 'DRAFTERROR', 'NEEDPARSE', 'PARSEDRAFT'].includes(currentStatus || ''))
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
