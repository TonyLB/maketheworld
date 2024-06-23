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
import { GenericTreeNodeFiltered, TreeId } from "@tonylb/mtw-wml/dist/tree/baseClasses"
import { SchemaPromptTag, SchemaTag } from "@tonylb/mtw-wml/dist/schema/baseClasses"
import SidebarTitle from "../SidebarTitle"
import ConnectionTable from "../ConnectionTable"

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
    const { assetKey, updateSchema, standardForm, normalForm } = useLibraryAsset()
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
        return schemaOutputToString(component.name.children)
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
    const allExportKeys = Object.values(normalForm).map(({ key, exportAs }) => (exportAs ?? key))
    const nameValidate = useCallback((toKey: string) => (!(toKey !== ComponentId && (allExportKeys.includes(toKey)))), [ComponentId, allExportKeys])
    if (!(ComponentId && ComponentId in normalForm)) {
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
                <EditSchema tag="Name" field={component ? component.name : { data: { tag: 'Name' }, children: [], id: '' }} parentId={component?.id ?? ''}>
                    <TitledBox title="Name">
                        <DescriptionEditor
                            validLinkTags={[]}
                            fieldName="name"
                            toolbar={false}
                        />
                    </TitledBox>
                </EditSchema>
                <SidebarTitle title="Prompts" minHeight="8em">
                    <Prompts tree={component.prompts} parentId={component.id} />
                </SidebarTitle>
                <ConnectionTable
                    label="Rooms"
                    minHeight="5em"
                    target={ComponentId}
                    tag="Room"
                    orientation="children"
                />
                <ConnectionTable
                    label="Maps"
                    tag="Map"
                    orientation="children"
                    minHeight="5em"
                    target={ComponentId}
                />
            </Box>
            <DraftLockout />
        </Box>
    </Box>
}

export default ThemeEditor