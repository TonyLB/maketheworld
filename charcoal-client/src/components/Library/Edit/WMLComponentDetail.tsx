import { FunctionComponent, useCallback, useState } from 'react'
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
import useDebouncedCallback from './useDebouncedCallback'
import { useLibraryAsset } from './LibraryAsset'
import RoomExits from './RoomExits'

interface WMLComponentDetailProps {
}

export const WMLComponentDetail: FunctionComponent<WMLComponentDetailProps> = () => {
    const { assetKey, normalForm, wmlQuery, updateWML, components } = useLibraryAsset()
    const { ComponentId } = useParams<{ ComponentId: string }>()
    const component = normalForm[ComponentId || '']
    const { tag } = component || {}
    const onChange = useCallback((newRender) => {
        let spaceBefore = newRender.length > 0 && newRender[0].tag === 'String' && newRender[0].value.search(/^\s+/) !== -1
        let spaceAfter = newRender.length > 0 && newRender[newRender.length - 1].tag === 'String' && newRender[newRender.length - 1].value.search(/\s+$/) !== -1
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
                .prop('spaceBefore', spaceBefore, { type: 'boolean' })
                .prop('spaceAfter', spaceAfter, { type: 'boolean' })
                .render(newRender)

        }
        updateWML(componentsQuery.source)
    }, [wmlQuery, tag, updateWML])
    const [name, setName] = useState(components[component.key]?.localName || '')

    const dispatchNameChange = useCallback((value) => {
        const componentQuery = wmlQuery.search(tag).not(`Condition ${tag}`).not(`Map ${tag}`).add(`[key="${ComponentId}"] Name`)
        if (componentQuery) {
            componentQuery.remove()
        }
        if (name) {
            const spaceBefore = name.search(/^\s+/) !== -1
            const spaceAfter = name.search(/\s+$/) !== -1
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
            if (name) {
                componentsQuery
                    .extend()
                    .add(':first')
                    .addElement(`<Name${ spacingProps.length ? ` ${spacingProps.join(' ')} ` : ''}>${name.trim()}</Name>`, { position: 'after' })
            }
        }
        updateWML(componentQuery.source)
    }, [updateWML, wmlQuery, name, tag, ComponentId])
    const onChangeName = useDebouncedCallback(dispatchNameChange)
    const changeName = useCallback((event) => {
        setName(event.target.value)
        onChangeName(event.target.value)
    }, [setName])
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
                    spaceBefore={components[component.key]?.spaceBefore}
                    spaceAfter={components[component.key]?.spaceAfter}
                    onChange={onChange}
                />
            </Box>
            {
                (tag === 'Room') && <RoomExits RoomId={ComponentId || ''} />
            }
        </Box>
}

export default WMLComponentDetail
