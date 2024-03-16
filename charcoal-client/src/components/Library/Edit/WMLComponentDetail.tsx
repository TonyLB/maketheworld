import { FunctionComponent, useCallback, useMemo } from 'react'
import {
    useLocation,
    useNavigate,
    useParams
} from "react-router-dom"

import Box from '@mui/material/Box'
import HomeIcon from '@mui/icons-material/Home'
import { blue } from '@mui/material/colors'

import LibraryBanner from './LibraryBanner'
import DescriptionEditor from './DescriptionEditor'
import { useLibraryAsset } from './LibraryAsset'
import { isSchemaAsset, isSchemaKnowledge, isSchemaOutputTag, isSchemaRoom, SchemaFeatureTag, SchemaKnowledgeTag, SchemaOutputTag, SchemaRoomTag, SchemaTag } from '@tonylb/mtw-wml/dist/schema/baseClasses'
import { isSchemaFeature } from '@tonylb/mtw-wml/dist/schema/baseClasses'
import DraftLockout from './DraftLockout'
import RoomExitEditor from './RoomExitEditor'
import useAutoPin from '../../../slices/UI/navigationTabs/useAutoPin'
import { useOnboardingCheckpoint } from '../../Onboarding/useOnboarding'
import { addOnboardingComplete } from '../../../slices/player/index.api'
import { useDispatch } from 'react-redux'
import { rename as renameNavigationTab } from '../../../slices/UI/navigationTabs'
import { GenericTree, GenericTreeNode, GenericTreeNodeFiltered, TreeId } from '@tonylb/mtw-wml/dist/tree/baseClasses'
import { explicitSpaces } from '@tonylb/mtw-wml/dist/schema/utils/schemaOutput/explicitSpaces'
import { treeTypeGuard } from '@tonylb/mtw-wml/dist/tree/filter'
import { selectNameAsString } from '@tonylb/mtw-wml/dist/normalize/selectors/name'
import { EditSchema } from './EditContext'
import { UpdateSchemaPayload } from '../../../slices/personalAssets/reducers'
import { isStandardFeature, isStandardKnowledge, isStandardRoom, SchemaStandardField, StandardFeature, StandardKnowledge, StandardRoom } from '@tonylb/mtw-wml/dist/standardize/baseClasses'

//
// TODO: Create a selector that can extract the top-level appearance for a given Component (assuming Standardized
// format on the passed schema)
//

const WMLComponentAppearance: FunctionComponent<{ ComponentId: string }> = ({ ComponentId }) => {
    const { updateSchema, standardForm } = useLibraryAsset()
    const dispatch = useDispatch()
    const component: StandardFeature | StandardKnowledge | StandardRoom = useMemo(() => {
        if (ComponentId) {
            const component = standardForm[ComponentId]
            if (component && (isStandardFeature(component) || isStandardKnowledge(component) || isStandardRoom(component))) {
                return component
            }
        }
        return {
            key: ComponentId,
            id: '',
            tag: 'Room',
            shortName: { id: '', value: [] },
            name: { id: '', value: [] },
            summary: { id: '', value: [] },
            description: { id: '', value: [] },
            exits: []
        }
    }, [ComponentId, standardForm])
    const { tag } = component
    useOnboardingCheckpoint('navigateRoom', { requireSequence: true, condition: tag === 'Room' })
    useOnboardingCheckpoint('navigateAssetWithImport', { requireSequence: true })

    const onChange = useCallback((tag: 'Name' | 'Description', current: SchemaStandardField) => (action: UpdateSchemaPayload) => {
        if (action.type !== 'replace') {
            throw new Error('Incorrect arguments to WMLComponentDetail onChange')
        }
        const newRender = treeTypeGuard({ tree: action.item.children, typeGuard: isSchemaOutputTag })
        const adjustedRender = explicitSpaces(newRender)
        if (isStandardRoom(component) && adjustedRender?.length)  {
            dispatch(addOnboardingComplete(['describeRoom']))
        }
        //
        // Use internal UUIDs in appearance to update schema with new output data
        //
        if (component.id) {
            if (current.id) {
                if (adjustedRender.length) {
                    updateSchema({
                        type: 'replace',
                        id: current.id,
                        item: {
                            data: { tag },
                            children: adjustedRender,
                            id: current.id
                        }
                    })
                }
                else {
                    updateSchema({
                        type: 'delete',
                        id: current.id
                    })
                }
            }
            else {
                updateSchema({
                    type: 'addChild',
                    id: component.id,
                    item: {
                        data: { tag },
                        children: adjustedRender
                    }
                })
            }
        }
    }, [component, updateSchema, dispatch])
    const onChangeDescription = useCallback(onChange('Description', component.description), [onChange])
    const onChangeName = useCallback(onChange('Name', component.name), [onChange])
    const descriptionOutput = useMemo(() => (component.description.value), [component])
    const nameOutput = useMemo(() => (component.name.value), [component])
    if (!component.id) {
        return <Box />
    }
    return <Box sx={{
        marginLeft: '0.5em',
        marginTop: '0.5em',
        display: 'flex',
        flexDirection: 'column',
        rowGap: '0.25em',
        width: "calc(100% - 0.5em)",
        position: 'relative'
    }}>
        <EditSchema schema={nameOutput ? [{ data: { tag: 'Name' }, children: nameOutput, id: component.name.id }] : [{ data: { tag: 'Name' }, children: [], id: 'STUB' }]} updateSchema={onChangeName}>
            <DescriptionEditor
                validLinkTags={[]}
                placeholder="Enter a name"
            />
        </EditSchema>
        <EditSchema schema={descriptionOutput ? [{ data: { tag: 'Description' }, children: descriptionOutput, id: component.description.id }] : [{ data: { tag: 'Description' }, children: [], id: 'STUB' }]} updateSchema={onChangeDescription}>
            <Box sx={{ border: `2px solid ${blue[500]}`, borderRadius: '0.5em' }}>
                <DescriptionEditor
                    validLinkTags={tag === 'Knowledge' ? ['Knowledge'] : ['Action', 'Feature', 'Knowledge']}
                    placeholder="Enter a description"
                />
            </Box>
        </EditSchema>
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
    const { assetKey, normalForm, updateSchema, select } = useLibraryAsset()
    const { ComponentId } = useParams<{ ComponentId: string }>()
    const location = useLocation()
    const tag = location.pathname.split('/').slice(-2)[0]
    const componentName = useMemo(() => (select({ key: ComponentId, selector: selectNameAsString })), [select, ComponentId])
    useAutoPin({
        href: `/Library/Edit/Asset/${assetKey}/${tag}/${ComponentId}`,
        label: componentName || 'Untitled',
        type: 'ComponentEdit',
        iconName: 'Room',
        assetId: `ASSET#${assetKey}`,
        componentId: ComponentId || ''
    })
    const onNameChange = useCallback((toKey: string) => {
        updateSchema({
            type: 'rename',
            fromKey: ComponentId,
            toKey
        })
        dispatch(renameNavigationTab({
            fromHRef: `/Library/Edit/Asset/${assetKey}/${tag}/${ComponentId}`,
            toHRef: `/Library/Edit/Asset/${assetKey}/${tag}/${toKey}`,
            componentId: toKey
        }))
        navigate(`/Library/Edit/Asset/${assetKey}/${tag}/${toKey}`)
    }, [updateSchema, ComponentId, navigate, assetKey, dispatch, tag])
    const allExportKeys = Object.values(normalForm).map(({ key, exportAs }) => (exportAs ?? key))
    const nameValidate = useCallback((toKey: string) => (!(toKey !== ComponentId && (allExportKeys.includes(toKey)))), [ComponentId, allExportKeys])
    if (!(ComponentId && ComponentId in normalForm)) {
        return <Box />
    }
    return <Box sx={{ width: "100%", display: 'flex', flexDirection: 'column', flexGrow: 1 }}>
        <LibraryBanner
            primary={componentName}
            secondary={ComponentId}
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
