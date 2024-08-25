import { FunctionComponent, useCallback, useMemo } from "react"
import { useDispatch } from "react-redux"
import { useNavigate, useParams } from "react-router-dom"

import Box from '@mui/material/Box'
import HomeIcon from '@mui/icons-material/Home'
import TextField from "@mui/material/TextField"

import { useLibraryAsset } from "../LibraryAsset"
import useAutoPin from "../../../../slices/UI/navigationTabs/useAutoPin"
import DraftLockout from "../DraftLockout"
import { StandardTheme, isStandardTheme } from "@tonylb/mtw-wml/dist/standardize/baseClasses"
import { schemaOutputToString } from "@tonylb/mtw-wml/dist/schema/utils/schemaOutput/schemaOutputToString"
import { rename as renameNavigationTab } from '../../../../slices/UI/navigationTabs'
import LibraryBanner from "../LibraryBanner"
import { EditSchema } from "../EditContext"
import TitledBox from "../../../TitledBox"
import DescriptionEditor from "../DescriptionEditor"
import treeListFactory from "../treeListFactory"
import { GenericTreeNodeFiltered, TreeId, treeNodeTypeguard } from "@tonylb/mtw-wml/dist/tree/baseClasses"
import { SchemaAssetTag, SchemaCharacterTag, SchemaPromptTag, SchemaStoryTag, SchemaTag, SchemaWithKey, isSchemaAsset, isSchemaCharacter, isSchemaWithKey } from "@tonylb/mtw-wml/dist/schema/baseClasses"
import SidebarTitle from "../SidebarTitle"
import SchemaTagTree from "@tonylb/mtw-wml/dist/tagTree/schema"
import { ignoreWrapped } from "@tonylb/mtw-wml/dist/schema/utils"
import { StandardFormSchema } from "../StandardFormContext"

const PromptItem: FunctionComponent<{ node: GenericTreeNodeFiltered<SchemaPromptTag, SchemaTag, TreeId>}> = ({ node }) => {
    const { updateSchema } = useLibraryAsset()
    const value = useMemo(() => (node.data.value), [node])
    const onChange = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
        updateSchema({ type: 'updateNode', id: node.id, item: { tag: 'Prompt', value: event.target.value }})
    }, [updateSchema, node.id])
    return <TextField label="Prompt" variant="standard" value={value} onChange={onChange} />
}

const Prompts = treeListFactory<SchemaPromptTag>({
    render: ({ node }) => (<PromptItem node={node} />),
    defaultNode: { tag: 'Prompt', value: '' },
    label: 'Prompt'
})

type ThemeEditorProps = {}

export const ThemeEditor: FunctionComponent<ThemeEditorProps> = () => {
    const navigate = useNavigate()
    const dispatch = useDispatch()
    const { assetKey, updateSchema, standardForm, updateStandard } = useLibraryAsset()
    const { ComponentId } = useParams<{ ComponentId: string }>()
    const component: StandardTheme = useMemo(() => {
        if (ComponentId) {
            const component = standardForm.byId[ComponentId]
            if (component && isStandardTheme(component)) {
                return component
            }
        }
        return {
            key: ComponentId,
            id: '',
            tag: 'Theme',
            name: { data: { tag: 'Name' }, children: [], id: '' },
            prompts: [],
            rooms: [],
            maps: []
        }
    }, [ComponentId, standardForm])
    const componentName = useMemo(() => {
        return schemaOutputToString(ignoreWrapped(component.name)?.children ?? [])
    }, [component])
    useAutoPin({
        href: `/Library/Edit/Asset/${assetKey}/Theme/${ComponentId}`,
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
            fromHRef: `/Library/Edit/Asset/${assetKey}/Theme/${ComponentId}`,
            toHRef: `/Library/Edit/Asset/${assetKey}/Theme/${toKey}`,
            componentId: toKey
        }))
        navigate(`/Library/Edit/Asset/${assetKey}/Theme/${toKey}`)
    }, [updateSchema, ComponentId, navigate, assetKey, dispatch])
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
                <StandardFormSchema componentKey={ComponentId} tag="Name">
                    <EditSchema
                        field={component?.name ? component.name : { data: { tag: 'Name' }, children: [], id: '' }}
                        value={component?.name?.children ?? []}
                        onChange={(value) => { updateStandard({ type: 'replaceItem', componentKey: ComponentId, itemKey: 'name', item: { data: { tag: 'Name' }, children: value }})}}
                        onDelete={() => {}}
                    >
                        <TitledBox title="Name">
                            <DescriptionEditor validLinkTags={[]} toolbar={false} />
                        </TitledBox>
                    </EditSchema>
                </StandardFormSchema>
                <SidebarTitle title="Prompts" minHeight="8em">
                    <Prompts tree={component.prompts} parentId={component.id} />
                </SidebarTitle>
            </Box>
            <DraftLockout />
        </Box>
    </Box>
}

export default ThemeEditor