import React, { FunctionComponent, useCallback, useMemo } from "react"
import { useDispatch } from "react-redux"
import { useNavigate, useParams } from "react-router-dom"

import Box from '@mui/material/Box'
import HomeIcon from '@mui/icons-material/Home'

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

const PromptItem: FunctionComponent<{ node: GenericTreeNodeFiltered<SchemaPromptTag, SchemaTag, TreeId>}> = ({ node }) => {
    return <React.Fragment>Prompt: {node.data.value}</React.Fragment>
}

const Prompts = treeListFactory<SchemaPromptTag>({
    render: PromptItem,
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
                            placeholder="Name"
                            toolbar={false}
                        />
                    </TitledBox>
                </EditSchema>
                <SidebarTitle title="Prompts" minHeight="8em">
                    <Prompts tree={component.prompts} parentId={component.id} />
                </SidebarTitle>
            </Box>
            <DraftLockout />
        </Box>
    </Box>
}

export default ThemeEditor