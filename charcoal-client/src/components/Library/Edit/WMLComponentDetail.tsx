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
import { GenericTree, TreeId, treeNodeTypeguard } from '@tonylb/mtw-wml/dist/tree/baseClasses'
import { isSchemaAsset, isSchemaCharacter, isSchemaInherited, isSchemaWithKey, SchemaAssetTag, SchemaCharacterTag, SchemaStoryTag, SchemaTag, SchemaWithKey } from '@tonylb/mtw-wml/dist/schema/baseClasses'
import SchemaTagTree from '@tonylb/mtw-wml/dist/tagTree/schema'
import { ignoreWrapped } from '@tonylb/mtw-wml/dist/schema/utils'
import { addOnboardingComplete } from '../../../slices/player/index.api'
import { StandardFormSchema } from './StandardFormContext'

const unwrapInherited = (tree: GenericTree<SchemaTag, TreeId>): GenericTree<SchemaTag, TreeId> => {
    return tree.map((node) => (treeNodeTypeguard(isSchemaInherited)(node) ? unwrapInherited(node.children) : [{ ...node, children: unwrapInherited(node.children) }])).flat(1)
}

const WMLComponentAppearance: FunctionComponent<{ ComponentId: string }> = ({ ComponentId }) => {
    const { standardForm, inheritedStandardForm, updateStandard } = useLibraryAsset()
    const dispatch = useDispatch()
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
            (isStandardRoom(component)) && <StandardFormSchema componentKey={ComponentId} tag="ShortName">
                <EditSchema
                    value={component?.shortName?.children ?? []}
                    inherited={(inherited && isStandardRoom(inherited) && inherited.shortName) ? unwrapInherited([inherited.shortName])[0] : undefined }
                    onChange={(value) => { updateStandard({ type: 'replaceItem', componentKey: ComponentId, itemKey: 'shortName', item: value.length ? { data: { tag: 'ShortName' }, children: value } : undefined }) }}
                >
                    <TitledBox title="Short Name">
                        <DescriptionEditor
                            validLinkTags={[]}
                            toolbar={false}
                        />
                    </TitledBox>
                </EditSchema>
            </StandardFormSchema>
        }
        <StandardFormSchema componentKey={ComponentId} tag="Name">
            <EditSchema
                value={component?.name?.children ?? []}
                inherited={inherited?.name ? unwrapInherited([inherited.name])[0] : undefined }
                onChange={(value) => { updateStandard({ type: 'replaceItem', componentKey: ComponentId, itemKey: 'name', item: value.length ? { data: { tag: 'Name' }, children: value } : undefined }) }}
            >
                <TitledBox title={tag === 'Room' ? "Full Name" : "Name" }>
                    <DescriptionEditor
                        toolbar
                        validLinkTags={[]}
                    />
                </TitledBox>
            </EditSchema>
        </StandardFormSchema>
        {
            isStandardRoom(component) && <StandardFormSchema componentKey={ComponentId} tag="Summary">
                <EditSchema
                    value={component?.summary?.children ?? []}
                    inherited={inherited && isStandardRoom(inherited) && inherited.summary ? unwrapInherited([inherited.summary])[0] : undefined }
                    onChange={(value) => {
                        if (value.length) {
                            dispatch(addOnboardingComplete(['summarizeRoom']))
                        }
                        updateStandard({ type: 'replaceItem', componentKey: ComponentId, itemKey: 'summary', item: value.length ? { data: { tag: 'Summary' }, children: value } : undefined })
                    }}
                >
                    <TitledBox title="Summary">
                        <DescriptionEditor
                            toolbar
                            validLinkTags={tag === 'Knowledge' ? ['Knowledge'] : ['Action', 'Feature', 'Knowledge']}
                            checkPoints={['summarizeRoom']}
                        />
                    </TitledBox>
                </EditSchema>
            </StandardFormSchema>
        }
        <StandardFormSchema componentKey={ComponentId} tag="Description">
            <EditSchema
                value={component?.description?.children ?? []}
                inherited={inherited?.description ? unwrapInherited([inherited.description])[0] : undefined }
                onChange={(value) => {
                    if (value.length) {
                        dispatch(addOnboardingComplete(['describeRoom']))
                    }
                    updateStandard({ type: 'replaceItem', componentKey: ComponentId, itemKey: 'description', item: value.length ? { data: { tag: 'Description' }, children: value } : undefined })
                }}
            >
                <TitledBox>
                    <DescriptionEditor
                        toolbar
                        validLinkTags={tag === 'Knowledge' ? ['Knowledge'] : ['Action', 'Feature', 'Knowledge']}
                        checkPoints={isStandardRoom(component) ? ['describeRoom'] : undefined}
                    />
                </TitledBox>
            </EditSchema>
        </StandardFormSchema>
        {
            isStandardRoom(component) && <RoomExitEditor RoomId={ComponentId || ''} onChange={() => {}} />
        }
    </Box>
    : <Box />
}

interface WMLComponentDetailProps {
}

export const WMLComponentDetail: FunctionComponent<WMLComponentDetailProps> = () => {
    const navigate = useNavigate()
    const dispatch = useDispatch()
    const { assetKey, updateStandard, standardForm, combinedStandardForm } = useLibraryAsset()
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
        updateStandard({
            type: 'renameKey',
            from: ComponentId,
            to: toKey
        })
        dispatch(renameNavigationTab({
            fromHRef: `/Library/Edit/Asset/${assetKey}/${tag}/${ComponentId}`,
            toHRef: `/Library/Edit/Asset/${assetKey}/${tag}/${toKey}`,
            componentId: toKey
        }))
        navigate(`/Library/Edit/Asset/${assetKey}/${tag}/${toKey}`)
    }, [updateStandard, ComponentId, navigate, assetKey, dispatch, tag])
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
