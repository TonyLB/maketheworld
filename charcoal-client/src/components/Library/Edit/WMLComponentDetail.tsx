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
import { isSchemaAsset, isSchemaKnowledge, isSchemaOutputTag, isSchemaRoom, isSchemaWithKey, SchemaFeatureTag, SchemaKnowledgeTag, SchemaOutputTag, SchemaRoomTag, SchemaTag } from '@tonylb/mtw-wml/dist/simpleSchema/baseClasses'
import { isSchemaFeature } from '@tonylb/mtw-wml/dist/simpleSchema/baseClasses'
import DraftLockout from './DraftLockout'
import RoomExitEditor from './RoomExitEditor'
import { taggedMessageToString } from '@tonylb/mtw-interfaces/dist/messages'
import useAutoPin from '../../../slices/UI/navigationTabs/useAutoPin'
import { useOnboardingCheckpoint } from '../../Onboarding/useOnboarding'
import { addOnboardingComplete } from '../../../slices/player/index.api'
import { useDispatch } from 'react-redux'
import { rename } from '../../../slices/UI/navigationTabs'
import { GenericTree, GenericTreeNodeFiltered, TreeId } from '@tonylb/mtw-wml/dist/sequence/tree/baseClasses'
import { explicitSpaces } from '@tonylb/mtw-wml/dist/simpleSchema/utils/schemaOutput/explicitSpaces'
import { treeTypeGuard } from '@tonylb/mtw-wml/dist/sequence/tree/filter'

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

    const onChange = useCallback((tag: 'Name' | 'Description') => (newRender: GenericTree<SchemaOutputTag>) => {
        //
        // TODO: Figure out how to stop out-of-control looping on onChange in the case of minor
        // miscalibrations of the descendantsToRender function
        //
        const adjustedRender = explicitSpaces(newRender)
        if (isSchemaRoom(appearance.data) && adjustedRender?.length)  {
            dispatch(addOnboardingComplete(['describeRoom']))
        }
        //
        // Use internal UUIDs in appearance to update schema with new output data
        //
        if (appearance.id) {
            const tagToReplace = appearance.children
                .find((appearance) => (appearance.data.tag === tag))
            if (tagToReplace) {
                updateSchema({
                    type: 'replace',
                    id: tagToReplace.id,
                    item: {
                        data: tagToReplace.data,
                        children: adjustedRender
                    }
                })
            }
            else {
                updateSchema({
                    type: 'addChild',
                    id: appearance.id,
                    item: {
                        data: { tag },
                        children: adjustedRender
                    }
                })
            }
        }
    }, [appearance, updateSchema, dispatch])
    const onChangeDescription = useCallback(onChange('Description'), [onChange])
    const onChangeName = useCallback(onChange('Name'), [onChange])
    const extractOutput = useCallback((tag: 'Name' | 'Description'): GenericTree<SchemaOutputTag, TreeId> => {
        const matchedTag = appearance.children
            .find((appearance) => (appearance.data.tag === tag))
        return treeTypeGuard({ tree: matchedTag?.children ?? [], typeGuard: isSchemaOutputTag })
    }, [appearance])
    const descriptionOutput = useMemo(() => (extractOutput('Description')), [extractOutput])
    const nameOutput = useMemo(() => (extractOutput('Name')), [extractOutput])
    if (!component || !appearance) {
        return <Box />
    }
    //
    // TODO: Pull nameOutput and renderOutput from appearance, and use to populate DescriptionEditor
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
        <DescriptionEditor
            ComponentId={ComponentId}
            output={nameOutput}
            onChange={onChangeName}
        />
        <Box sx={{ border: `2px solid ${blue[500]}`, borderRadius: '0.5em' }}>
            <DescriptionEditor
                ComponentId={ComponentId}
                output={descriptionOutput}
                onChange={onChangeDescription}
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
    //
    // TODO: Add selectNameAsString selector
    //

    //
    // TODO: Use selectNameAsString instead of depending on components information
    //
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
