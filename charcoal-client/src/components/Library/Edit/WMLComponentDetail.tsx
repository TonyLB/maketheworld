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
import { EditSchema } from './EditContext'
import { isStandardFeature, isStandardKnowledge, isStandardMap, isStandardRoom, StandardFeature, StandardForm, StandardKnowledge, StandardRoom } from '@tonylb/mtw-wml/dist/standardize/baseClasses'
import TitledBox from '../../TitledBox'
import { schemaOutputToString } from '@tonylb/mtw-wml/dist/schema/utils/schemaOutput/schemaOutputToString'
import ConnectionTable from './ConnectionTable'
import { GenericTree, TreeId, treeNodeTypeguard } from '@tonylb/mtw-wml/dist/tree/baseClasses'
import { isSchemaAsset, isSchemaCharacter, isSchemaInherited, isSchemaWithKey, SchemaAssetTag, SchemaCharacterTag, SchemaStoryTag, SchemaTag, SchemaWithKey } from '@tonylb/mtw-wml/dist/schema/baseClasses'
import SchemaTagTree from '@tonylb/mtw-wml/dist/tagTree/schema'
import { ignoreWrapped } from '@tonylb/mtw-wml/dist/schema/utils'

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
                componentKey={ComponentId}
                tag="ShortName"
                field={component?.shortName ? component.shortName : { data: { tag: 'ShortName' }, children: [], id: '' }}
                inherited={(inherited && isStandardRoom(inherited) && inherited.shortName) ? unwrapInherited([inherited.shortName])[0] : undefined }
                parentId={component?.id ?? ''}
                onChange={() => {}}
            >
                <TitledBox title="Short Name">
                    <DescriptionEditor
                        componentKey={ComponentId}
                        validLinkTags={[]}
                        fieldName="shortName"
                        toolbar={false}
                    />
                </TitledBox>
            </EditSchema>
        }
        <EditSchema
            componentKey={ComponentId}
            tag="Name"
            field={component?.name ? component.name : { data: { tag: 'Name' }, children: [], id: '' }}
            inherited={inherited?.name ? unwrapInherited([inherited.name])[0] : undefined }
            parentId={component?.id ?? ''}
            onChange={() => {}}
        >
            <TitledBox title={tag === 'Room' ? "Full Name" : "Name" }>
                <DescriptionEditor
                    componentKey={ComponentId}
                    toolbar
                    validLinkTags={[]}
                    fieldName="name"
                />
            </TitledBox>
        </EditSchema>
        {
            isStandardRoom(component) && <EditSchema
                componentKey={ComponentId}
                tag="Summary"
                field={component?.summary ? component.summary : { data: { tag: 'Summary' }, children: [], id: '' }}
                inherited={inherited && isStandardRoom(inherited) && inherited.summary ? unwrapInherited([inherited.summary])[0] : undefined }
                parentId={component?.id ?? ''}
                onChange={() => {}}
            >
                <TitledBox title="Summary">
                    <DescriptionEditor
                        componentKey={ComponentId}
                        toolbar
                        validLinkTags={tag === 'Knowledge' ? ['Knowledge'] : ['Action', 'Feature', 'Knowledge']}
                        fieldName="summary"
                        checkPoints={['summarizeRoom']}
                    />
                </TitledBox>
            </EditSchema>
        }
        <EditSchema
            componentKey={ComponentId}
            tag="Description"
            field={component?.description ? component.description : { data: { tag: 'Description' }, children: [], id: '' } }
            inherited={inherited?.description ? unwrapInherited([inherited.description])[0] : undefined }
            parentId={component?.id ?? ''}
            onChange={() => {}}
        >
            <TitledBox>
                <DescriptionEditor
                    componentKey={ComponentId}
                    toolbar
                    validLinkTags={tag === 'Knowledge' ? ['Knowledge'] : ['Action', 'Feature', 'Knowledge']}
                    fieldName="description"
                    checkPoints={isStandardRoom(component) ? ['describeRoom'] : undefined}
                />
            </TitledBox>
        </EditSchema>
        {
            isStandardRoom(component) && <React.Fragment>
                <RoomExitEditor RoomId={ComponentId || ''} onChange={() => {}} />
                {/* <ConnectionTable
                    label="Themes"
                    minHeight="10em"
                    target={ComponentId}
                    tag="Theme"
                    orientation="parents"
                /> */}
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
                return schemaOutputToString(ignoreWrapped(component.shortName)?.children ?? [])
            }
            else if (isStandardFeature(component) || isStandardKnowledge(component) || isStandardMap(component)) {
                return schemaOutputToString(ignoreWrapped(component.name)?.children ?? [])
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
