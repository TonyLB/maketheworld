import { FunctionComponent, useCallback, useEffect, useState, useMemo } from 'react'
import {
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
import RoomExits from './RoomExits'
import useDebounce from '../../../hooks/useDebounce'
import { ComponentRenderItem } from '@tonylb/mtw-wml/dist/normalize/baseClasses'

interface WMLComponentDetailProps {
}

export const WMLComponentDetail: FunctionComponent<WMLComponentDetailProps> = () => {
    const { assetKey, normalForm, wmlQuery, updateWML, components } = useLibraryAsset()
    const { ComponentId } = useParams<{ ComponentId: string }>()
    const component = normalForm[ComponentId || '']
    const { tag } = component || {}
    const onChange = useCallback((newRender: ComponentRenderItem[]) => {
        const adjustedRender = newRender.reduce<ComponentRenderItem[]>((previous, item, index) => {
            if (index === 0 && item.tag === 'String' && item.value.search(/^\s+/) !== -1) {
                return [
                    ...previous,
                    {
                        tag: 'Space'
                    },
                    {
                        tag: 'String',
                        value: item.value.trimStart()
                    }
                ]
            }
            if ((index === newRender.length - 1) && item.tag === 'String' && item.value.search(/\s+$/) !== -1) {
                return [
                    ...previous,
                    {
                        tag: 'String',
                        value: item.value.trimEnd()
                    },
                    {
                        tag: 'Space'
                    }
                ]
            }
            return [
                ...previous,
                item
            ]
        }, [])
        const componentsQuery = wmlQuery
            .search(`${tag}[key="${ComponentId}"]`)
            .not(`Condition ${tag}`)
            .not(`Map ${tag}`)
        componentsQuery
            .extend()
            .add('Description')
            .remove()
        if (newRender.length > 0) {
            componentsQuery
                .extend()
                .add(':first')
                .addElement(`<Description></Description>`, { position: 'after' })
            componentsQuery
                .extend()
                .add('Description')
                .render(adjustedRender)
        }
        updateWML(componentsQuery.source)
    }, [wmlQuery, tag, updateWML])
    const defaultName = useMemo(() => (components[component.key]?.localName || ''), [components, component.key])
    const [name, setName] = useState(defaultName)

    const dispatchNameChange = useCallback((value) => {
        const componentQuery = wmlQuery.search(tag).not(`Condition ${tag}`).not(`Map ${tag}`).add(`[key="${ComponentId}"] Name`)
        if (componentQuery) {
            componentQuery.remove()
        }
        if (value) {
            const spaceBefore = value.search(/^\s+/) !== -1
            const spaceAfter = value.search(/\s+$/) !== -1
            const spacingProps = [
                ...(spaceBefore ? ['spaceBefore'] : []),
                ...(spaceAfter ? ['spaceAfter'] : []),
            ]
            const componentsQuery = wmlQuery.search(`${tag}[key="${ComponentId}"]`)
                .not(`Condition ${tag}`)
                .not(`Map ${tag}`)
            if (tag === 'Feature') {
                componentsQuery.not(`Room Feature`)
            }
            componentsQuery
                .extend()
                .add('Name')
                .remove()
            componentsQuery
                .extend()
                .add(':first')
                .addElement(`<Name${ spacingProps.length ? ` ${spacingProps.join(' ')} ` : ''}>${value.trim()}</Name>`, { position: 'after' })
        }
        else {
            const componentsQuery = wmlQuery.search(`${tag}[key="${ComponentId}"]`)
                .not(`Condition ${tag}`)
                .not(`Map ${tag}`)
            if (tag === 'Feature') {
                componentsQuery.not(`Room Feature`)
            }
            componentsQuery
                .add('Name')
                .remove()
        }
        updateWML(componentQuery.source)
    }, [updateWML, wmlQuery, tag, ComponentId])
    const changeName = useCallback((event) => {
        setName(event.target.value)
    }, [setName])
    const debouncedName = useDebounce(name, 1000)
    useEffect(() => {
        if (debouncedName !== defaultName) {
            dispatchNameChange(debouncedName)
        }
    }, [debouncedName, defaultName])
    if (!component) {
        return <Box />
    }
    return <Box sx={{ width: "100%" }}>
            <LibraryBanner
                primary={components[component.key]?.name || 'Untitled'}
                secondary={component.key}
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
                    label: components[component.key]?.name || 'Untitled'
                }]}
            />

            <Box sx={{
                marginLeft: '0.5em',
                display: 'flex',
                alignItems: 'center',
            }}>
                <Box
                    sx={{
                        height: "100%",
                        background: 'lightgrey',
                        verticalAlign: 'middle',
                        display: 'inline'
                    }}
                >
                    { components[component.key]?.defaultName || '' }
                </Box>
                <TextField
                    id="name"
                    label="Name"
                    size="small"
                    value={name}
                    onChange={changeName}
                />
            </Box>
            <Box sx={{ border: `2px solid ${blue[500]}`, borderRadius: '0.5em' }}>
                <DescriptionEditor
                    inheritedRender={components[component.key]?.defaultRender}
                    render={components[component.key]?.localRender || []}
                    onChange={onChange}
                />
            </Box>
            {
                (tag === 'Room') && <RoomExits RoomId={ComponentId || ''} />
            }
        </Box>
}

export default WMLComponentDetail
