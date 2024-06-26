import React, { FunctionComponent, useCallback, useMemo } from 'react'
import {
    useLocation,
    useNavigate,
    useParams
} from "react-router-dom"

import Box from '@mui/material/Box'
import HomeIcon from '@mui/icons-material/Home'

import LibraryBanner from './LibraryBanner'
import DescriptionEditor from './DescriptionEditor'
import { useLibraryAsset } from './LibraryAsset'
import DraftLockout from './DraftLockout'
import RoomExitEditor from './RoomExitEditor'
import useAutoPin from '../../../slices/UI/navigationTabs/useAutoPin'
import { useOnboardingCheckpoint } from '../../Onboarding/useOnboarding'
import { useDispatch } from 'react-redux'
import { rename as renameNavigationTab } from '../../../slices/UI/navigationTabs'
import { selectNameAsString } from '@tonylb/mtw-wml/dist/normalize/selectors/name'
import { EditSchema } from './EditContext'
import { isStandardBookmark, isStandardFeature, isStandardKnowledge, isStandardMap, isStandardRoom, StandardFeature, StandardForm, StandardKnowledge, StandardRoom } from '@tonylb/mtw-wml/dist/standardize/baseClasses'
import TitledBox from '../../TitledBox'
import { schemaOutputToString } from '@tonylb/mtw-wml/dist/schema/utils/schemaOutput/schemaOutputToString'
import ConnectionTable from './ConnectionTable'
import { GenericTree, TreeId, treeNodeTypeguard } from '@tonylb/mtw-wml/dist/tree/baseClasses'
import { isSchemaAsset, isSchemaCharacter, isSchemaInherited, isSchemaWithKey, SchemaAssetTag, SchemaCharacterTag, SchemaStoryTag, SchemaTag, SchemaWithKey } from '@tonylb/mtw-wml/dist/schema/baseClasses'
import SchemaTagTree from '@tonylb/mtw-wml/dist/tagTree/schema'

const unwrapInherited = (tree: GenericTree<SchemaTag, TreeId>): GenericTree<SchemaTag, TreeId> => {
    return tree.map((node) => (treeNodeTypeguard(isSchemaInherited)(node) ? unwrapInherited(node.children) : [{ ...node, children: unwrapInherited(node.children) }])).flat(1)
}

const WMLComponentAppearance: FunctionComponent<{ ComponentId: string }> = ({ ComponentId }) => {
    const { standardForm, inheritedStandardForm, updateSchema } = useLibraryAsset()
    const [component, inherited]: [StandardFeature | StandardKnowledge | StandardRoom | undefined, StandardFeature | StandardKnowledge | StandardRoom | undefined] = useMemo(() => {
        const extractComponent = (standardForm: StandardForm): StandardFeature | StandardKnowledge | StandardRoom | undefined => {
            if (ComponentId) {
                const component = standardForm.byId[ComponentId]
                if (component && (isStandardFeature(component) || isStandardKnowledge(component) || isStandardRoom(component))) {
                    return component
                }
            }
            return undefined
        }
        return [extractComponent(standardForm), extractComponent(inheritedStandardForm)]
    }, [ComponentId, standardForm, inheritedStandardForm])
    const { tag } = component
    useOnboardingCheckpoint('navigateRoom', { requireSequence: true, condition: tag === 'Room' })
    useOnboardingCheckpoint('navigateAssetWithImport', { requireSequence: true })
    const onChangeShortName = useCallback((event: any) => {
        if (isStandardRoom(component)) {
            const newValue = event.target.value
            if (newValue) {
                if (component.shortName.id) {
                    updateSchema({
                        type: 'replaceChildren',
                        id: component.shortName.id,
                        children: [{ data: { tag: 'String', value: newValue }, children: [] }]
                    })
                }
                else {
                    updateSchema({
                        type: 'addChild',
                        id: component.id,
                        item: {
                            data: { tag: 'ShortName' },
                            children: [{ data: { tag: 'String', value: newValue }, children: [] }]
                        }
                    })
                }
            }
            else {
                if (component.shortName.id) {
                    updateSchema({
                        type: 'delete',
                        id: component.shortName.id
                    })
                }
            }
        }
    }, [component, updateSchema])

    return component.id ? <Box sx={{
        marginLeft: '0.5em',
        marginTop: '0.5em',
        display: 'flex',
        flexDirection: 'column',
        rowGap: '0.25em',
        width: "calc(100% - 0.5em)",
        position: 'relative'
    }}>
        {
            (isStandardRoom(component)) && <EditSchema
                tag="ShortName"
                field={component ? component.shortName : { data: { tag: 'ShortName' }, children: [], id: '' }}
                inherited={inherited && isStandardRoom(inherited) ? unwrapInherited([inherited.shortName])[0] : undefined }
                parentId={component?.id ?? ''}
            >
                <TitledBox title="Short Name">
                    <DescriptionEditor
                        validLinkTags={[]}
                        fieldName="short name"
                        toolbar={false}
                    />
                </TitledBox>
            </EditSchema>
        }
        <EditSchema
            tag="Name"
            field={component ? component.name : { data: { tag: 'Name' }, children: [], id: '' }}
            inherited={inherited ? unwrapInherited([inherited.name])[0] : undefined }
            parentId={component?.id ?? ''}
        >
            <TitledBox title={tag === 'Room' ? "Full Name" : "Name" }>
                <DescriptionEditor
                    toolbar
                    validLinkTags={[]}
                    fieldName="name"
                />
            </TitledBox>
        </EditSchema>
        {
            isStandardRoom(component) && <EditSchema
                tag="Summary"
                field={component ? component.summary : { data: { tag: 'Summary' }, children: [], id: '' }}
                inherited={inherited && isStandardRoom(inherited) ? unwrapInherited([inherited.summary])[0] : undefined }
                parentId={component?.id ?? ''}
            >
                <TitledBox title="Summary">
                    <DescriptionEditor
                        toolbar
                        validLinkTags={tag === 'Knowledge' ? ['Knowledge'] : ['Action', 'Feature', 'Knowledge']}
                        fieldName="summary"
                    />
                </TitledBox>
            </EditSchema>
        }
        <EditSchema
            tag="Description"
            field={component ? component.description : { data: { tag: 'Description' }, children: [], id: '' } }
            inherited={inherited ? unwrapInherited([inherited.description])[0] : undefined }
            parentId={component?.id ?? ''}
        >
            <TitledBox>
                <DescriptionEditor
                    toolbar
                    validLinkTags={tag === 'Knowledge' ? ['Knowledge'] : ['Action', 'Feature', 'Knowledge']}
                    fieldName="description"
                />
            </TitledBox>
        </EditSchema>
        {
            isStandardRoom(component) && <React.Fragment>
                <RoomExitEditor RoomId={ComponentId || ''} onChange={() => {}} />
                <ConnectionTable
                    label="Themes"
                    minHeight="10em"
                    target={ComponentId}
                    tag="Theme"
                    orientation="parents"
                />
            </React.Fragment>
        }
    </Box>
    : <Box />
}

interface WMLComponentDetailProps {
}

export const WMLComponentDetail: FunctionComponent<WMLComponentDetailProps> = () => {
    const navigate = useNavigate()
    const dispatch = useDispatch()
    const { assetKey, updateSchema, standardForm, combinedStandardForm } = useLibraryAsset()
    const { ComponentId } = useParams<{ ComponentId: string }>()
    const location = useLocation()
    const tag = location.pathname.split('/').slice(-2)[0]
    const componentName = useMemo(() => {
        const component = combinedStandardForm.byId[ComponentId]
        if (component) {
            if (isStandardRoom(component)) {
                return schemaOutputToString(component.shortName.children)
            }
            else if (isStandardFeature(component) || isStandardKnowledge(component) || isStandardMap(component)) {
                return schemaOutputToString(component.name.children)
            }
        }
        return ''
    }, [combinedStandardForm, ComponentId])
    useAutoPin({
        href: `${(assetKey ?? 'draft') === 'draft' ? '/Draft/' : `/Library/Edit/Asset/${assetKey}/`}${tag}/${ComponentId}`,
        label: componentName || 'Untitled',
        type: 'ComponentEdit',
        iconName: 'Room',
        assetId: `ASSET#${assetKey}`,
        componentId: ComponentId || ''
    })
    const onKeyChange = useCallback((toKey: string) => {
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
    const allExportKeys = useMemo(() => {
        const tagTree = new SchemaTagTree(standardForm.metaData)
            .filter({ match: 'Export' })
            .prune({ match: 'Export' })
        const exportMappings: Record<string, string> = Object.assign({}, ...tagTree.tree.map((node) => {
            const isSchemaWithKeyOtherThanAsset = (data: SchemaTag): data is Exclude<SchemaWithKey, SchemaAssetTag | SchemaStoryTag | SchemaCharacterTag> => (isSchemaWithKey(data) && !(isSchemaAsset(data) || isSchemaCharacter(data)))
            if (treeNodeTypeguard(isSchemaWithKeyOtherThanAsset)(node)) {
                return { [node.data.key]: node.data.as ?? node.data.key }
            }
            else {
                return {}
            }
        }))
        return Object.keys(standardForm.byId).map((key) => (exportMappings[key] ?? key))
    }, [standardForm])
    const nameValidate = useCallback((toKey: string) => (!(toKey !== ComponentId && (allExportKeys.includes(toKey)))), [ComponentId, allExportKeys])
    if (!(ComponentId && ComponentId in standardForm.byId)) {
        return <Box />
    }
    return <Box sx={{ width: "100%", display: 'flex', flexDirection: 'column', flexGrow: 1 }}>
        <LibraryBanner
            primary={componentName}
            secondary={ComponentId}
            onChangeSecondary={onKeyChange}
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
