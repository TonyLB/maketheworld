import { FunctionComponent, useCallback, useState, useMemo, useEffect } from 'react'
import {
    useNavigate,
    useParams
} from "react-router-dom"

import {
    Box,
    TextField
} from '@mui/material'
import HomeIcon from '@mui/icons-material/Home'
import { blue } from '@mui/material/colors'

import LibraryBanner from './LibraryBanner'
import DescriptionEditor from './DescriptionEditor'
import { useLibraryAsset } from './LibraryAsset'
import { useDebouncedOnChange } from '../../../hooks/useDebounce'
import { ComponentAppearance, ComponentRenderItem, isNormalComponent, isNormalFeature, isNormalKnowledge, isNormalRoom, NormalReference } from '@tonylb/mtw-wml/dist/normalize/baseClasses'
import Normalizer, { componentRenderToSchemaTaggedMessage } from '@tonylb/mtw-wml/dist/normalize'
import { isSchemaAsset, isSchemaKnowledge, isSchemaRoom, isSchemaWithKey, SchemaFeatureTag, SchemaKnowledgeTag, SchemaOutputTag, SchemaRoomTag, SchemaTag } from '@tonylb/mtw-wml/dist/simpleSchema/baseClasses'
import { isSchemaFeature } from '@tonylb/mtw-wml/dist/simpleSchema/baseClasses'
import DraftLockout from './DraftLockout'
import RoomExitEditor from './RoomExitEditor'
import { taggedMessageToString } from '@tonylb/mtw-interfaces/dist/messages'
import useAutoPin from '../../../slices/UI/navigationTabs/useAutoPin'
import { useOnboardingCheckpoint } from '../../Onboarding/useOnboarding'
import { addOnboardingComplete } from '../../../slices/player/index.api'
import { useDispatch } from 'react-redux'
import { rename } from '../../../slices/UI/navigationTabs'
import { GenericTree, GenericTreeNode, GenericTreeNodeFiltered, TreeId } from '@tonylb/mtw-wml/dist/sequence/tree/baseClasses'
import { explicitSpaces } from '@tonylb/mtw-wml/dist/simpleSchema/utils/schemaOutput/explicitSpaces'

//
// TODO: Create a selector that can extract the top-level appearance for a given Component (assuming Standardized
// format on the passed schema)
//

const WMLComponentAppearance: FunctionComponent<{ ComponentId: string }> = ({ ComponentId }) => {
    const { updateSchema, schema, normalForm, updateNormal, components, readonly } = useLibraryAsset()
    const dispatch = useDispatch()
    const component = useMemo(() => (normalForm[ComponentId || '']), [ComponentId, normalForm])
    const { tag } = component || {}
    useOnboardingCheckpoint('navigateRoom', { requireSequence: true, condition: tag === 'Room' })
    useOnboardingCheckpoint('navigateAssetWithImport', { requireSequence: true })

    //
    // Look up data directly through Normalize, and use that (plus the assumption that the
    // Schema is in standardized format) to find the appearance that holds all of the top-level
    // data for the component
    //
    const appearance = useMemo((): GenericTreeNodeFiltered<SchemaRoomTag | SchemaFeatureTag | SchemaKnowledgeTag, SchemaTag, TreeId> | undefined => {
        //
        // Temporary work-around:  Right now, the Appearance type constraints in NormalForm are too
        // complicated to accept a nested Extra argument. So in the short-term, instead of passing
        // GenericTree<SchemaTag, TreeId> into NormalForm, we're constructing the non-ID tree in
        // NormalForm, and just fetching the correct data straight out of the schema here.
        //

        //
        // TODO: When BaseAppearance has been rationalized down to a less complex type, and
        // Normalizer has been simplified down to a read-only entity rather than the complex
        // tangle it is now, refactor so that normalForm appearances already *have* the ID
        // data we're looking up here.
        //
        if (schema.length === 0) {
            throw new Error('No data in schema at WMLComponentDetail')
        }
        const { data: assetData } = schema[0]
        if (schema.length > 1 || !isSchemaAsset(assetData)) {
            throw new Error('Non-asset top level tag in schema at WMLComponentDetail')
        }
        const topLevelChildren = schema[0].children
        return topLevelChildren
            .reduce<GenericTreeNodeFiltered<SchemaRoomTag | SchemaFeatureTag | SchemaKnowledgeTag, SchemaTag, TreeId> | undefined>((previous, appearance) => {
                const { data } = appearance
                if (!(isSchemaRoom(data) || isSchemaFeature(data) || isSchemaKnowledge(data))) {
                    return previous
                }
                if (previous) {
                    throw new Error('Schema not standardized in WMLComponentAppearance')
                }
                return {
                    ...appearance,
                    data
                }
            }, undefined)
    }, [schema, ComponentId])

    const onChange = useCallback((newRender: GenericTree<SchemaOutputTag>) => {
        //
        // TODO: Figure out how to stop out-of-control looping on onChange in the case of minor
        // miscalibrations of the descendantsToRender function
        //
        const adjustedRender = explicitSpaces(newRender)
        const normalizer = new Normalizer()
        normalizer.loadNormal(normalForm)
        normalizer.standardize()
        const reference: NormalReference = { tag, key: ComponentId, index: 0 }
        const { data: baseSchema } = normalizer.referenceToSchema(reference)
        if (isSchemaRoom(baseSchema) || isSchemaFeature(baseSchema) || isSchemaKnowledge(baseSchema)) {
            if (isSchemaRoom(baseSchema) && adjustedRender?.length)  {
                dispatch(addOnboardingComplete(['describeRoom']))
            }
            //
            // TODO: Use internal UUIDs in appearance to create an updateSchema version of
            // this onChange
            //

            // updateNormal({
            //     type: 'put',
            //     item: {
            //         ...baseSchema,
            //         render: adjustedRender
            //     },
            //     position: { ...normalizer._referenceToInsertPosition(reference), replace: true },
            // })
        }
    }, [ComponentId, tag, normalForm, updateNormal, dispatch])
    const [name, setName] = useState(appearance?.name || [])
    useEffect(() => {
        setName(appearance?.name || [])
    }, [appearance, setName])
    const nameText = useMemo<string>(() => ((name || []).map((item) => ((item.tag === 'String') ? item.value : '')).join('')), [name])

    const dispatchNameChange = useCallback((value: ComponentRenderItem[]) => {
        const normalizer = new Normalizer()
        normalizer._normalForm = normalForm
        const reference: NormalReference = { tag, key: ComponentId, index: 0 }
        const baseSchema = normalizer.referenceToSchema(reference)
        if (isSchemaRoom(baseSchema) || isSchemaFeature(baseSchema) || isSchemaKnowledge(baseSchema)) {
            if (isSchemaRoom(baseSchema) && value?.length)  {
                dispatch(addOnboardingComplete(['nameRoom']))
            }
            updateNormal({
                type: 'put',
                item: {
                    ...baseSchema,
                    name: (value || []).map(componentRenderToSchemaTaggedMessage)
                },
                position: { ...normalizer._referenceToInsertPosition(reference), replace: true },
            })
        }
    }, [tag, ComponentId, normalForm, updateNormal, dispatch])
    const changeName = useCallback((event) => {
        setName([{ tag: 'String', value: event.target.value }])
    }, [setName])
    useDebouncedOnChange({ value: name, delay: 1000, onChange: dispatchNameChange })
    if (!component || !appearance) {
        return <Box />
    }
    //
    // TODO: Refactor DescriptionEditor to handle GenericTree<SchemaTag>, and then use that
    // for both Name and Description
    //
    return <Box sx={{
        marginLeft: '0.5em',
        marginTop: '0.5em',
        display: 'flex',
        flexDirection: 'column',
        rowGap: '0.25em',
        width: "calc(100% - 0.5em)",
        position: 'relative'
    }}>
        <Box
            sx={{
                height: "100%",
                background: 'lightgrey',
                verticalAlign: 'middle',
                display: 'inline'
            }}
        >
            { taggedMessageToString(components[ComponentId]?.inheritedName || []) }
        </Box>
        <TextField
            id="name"
            label="Name"
            size="small"
            value={nameText}
            onChange={changeName}
            disabled={readonly}
        />
        <Box sx={{ border: `2px solid ${blue[500]}`, borderRadius: '0.5em' }}>
            <DescriptionEditor
                ComponentId={ComponentId}
                render={appearance.render || []}
                onChange={onChange}
            />
        </Box>
        {
            (tag === 'Room') && <RoomExitEditor RoomId={ComponentId || ''} onChange={() => {}} />
        }
    </Box>
}

interface WMLComponentDetailProps {
}

export const WMLComponentDetail: FunctionComponent<WMLComponentDetailProps> = () => {
    const navigate = useNavigate()
    const dispatch = useDispatch()
    const { assetKey, normalForm, updateNormal, components } = useLibraryAsset()
    const { ComponentId } = useParams<{ ComponentId: string }>()
    const component = normalForm[ComponentId || '']
    const { tag = '' } = isNormalComponent(component) ? component : {}
    const componentName = taggedMessageToString(components[component.key]?.name ?? [{ tag: 'String', value: 'Untitled' }])
    useAutoPin({
        href: `/Library/Edit/Asset/${assetKey}/${tag}/${ComponentId}`,
        label: componentName || 'Untitled',
        type: 'ComponentEdit',
        iconName: 'Room',
        assetId: `ASSET#${assetKey}`,
        componentId: ComponentId || ''
    })
    const onNameChange = useCallback((toKey: string) => {
        updateNormal({
            type: 'rename',
            fromKey: ComponentId,
            toKey
        })
        dispatch(rename({
            fromHRef: `/Library/Edit/Asset/${assetKey}/${tag}/${ComponentId}`,
            toHRef: `/Library/Edit/Asset/${assetKey}/${tag}/${toKey}`,
            componentId: toKey
        }))
        navigate(`/Library/Edit/Asset/${assetKey}/${tag}/${toKey}`)
    }, [updateNormal, ComponentId, navigate, assetKey, dispatch, tag])
    const allExportKeys = Object.values(normalForm).map(({ key, exportAs }) => (exportAs ?? key))
    const nameValidate = useCallback((toKey: string) => (!(toKey !== ComponentId && (allExportKeys.includes(toKey)))), [ComponentId, allExportKeys])
    if (!component || !ComponentId) {
        return <Box />
    }
    return <Box sx={{ width: "100%", display: 'flex', flexDirection: 'column', flexGrow: 1 }}>
        <LibraryBanner
            primary={componentName}
            secondary={component.key}
            onChangeSecondary={onNameChange}
            validateSecondary={nameValidate}
            icon={<HomeIcon />}
            breadCrumbProps={[{
                href: '/Library',
                label: 'Library'
            },
            {
                href: `/Library/Edit/Asset/${assetKey}`,
                label: assetKey || ''
            },
            {
                label: componentName
            }]}
        />
        <Box sx={{ flexGrow: 1, position: "relative", width: "100%" }}>
            <Box sx={{ overflowY: 'auto' }}>
                <WMLComponentAppearance ComponentId={ComponentId} />
            </Box>
            <DraftLockout />
        </Box>
    </Box>
}

export default WMLComponentDetail
