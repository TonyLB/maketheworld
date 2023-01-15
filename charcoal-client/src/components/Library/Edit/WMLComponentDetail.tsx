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
import { ComponentRenderItem, NormalReference } from '@tonylb/mtw-wml/dist/normalize/baseClasses'
import Normalizer, { componentRenderToSchemaTaggedMessage } from '@tonylb/mtw-wml/dist/normalize'
import { isSchemaRoom } from '@tonylb/mtw-wml/dist/schema/baseClasses'
import { isSchemaFeature } from '@tonylb/mtw-wml/dist/schema/baseClasses'
import { deepEqual } from '../../../lib/objects'

interface WMLComponentDetailProps {
}

export const WMLComponentDetail: FunctionComponent<WMLComponentDetailProps> = () => {
    const { assetKey, normalForm, updateNormal, components } = useLibraryAsset()
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
        }, []).map(componentRenderToSchemaTaggedMessage)
        let nameSet = false
        if (ComponentId && ComponentId in normalForm) {
            const { appearances = [] } = normalForm[ComponentId]
            const normalizer = new Normalizer()
            normalizer._normalForm = normalForm
            appearances.forEach((appearance, index) => {
                const { contextStack } = appearance
                const reference: NormalReference = { tag, key: ComponentId, index }
                if (!contextStack.find(({ tag }) => (['If', 'Map'].includes(tag)))) {
                    const baseSchema = normalizer.referenceToSchema(reference)
                    if (isSchemaRoom(baseSchema) || isSchemaFeature(baseSchema)) {
                        updateNormal({
                            type: 'put',
                            item: {
                                ...baseSchema,
                                render: nameSet ? [] : adjustedRender
                            },
                            position: { ...normalizer._referenceToInsertPosition(reference), replace: true },
                        })
                        nameSet = true
                    }
                }
            })
        }
    }, [ComponentId, tag, normalForm, updateNormal])
    const defaultName = useMemo(() => {
        const localName = components[component.key]?.localName
        if (typeof localName === 'string') {
            return [{ tag: 'String' as 'String', value: localName }]
        }
        if (Array.isArray(localName)) {
            return localName
        }
        return []
    }, [components, component.key])
    const [name, setName] = useState(defaultName)
    console.log(`Name: ${JSON.stringify(name, null, 4)}`)
    const nameText = useMemo<string>(() => ((name || []).map((item) => ((item.tag === 'String') ? item.value : '')).join('')), [name])

    const dispatchNameChange = useCallback((value: ComponentRenderItem[]) => {
        let nameSet = false
        if (ComponentId && ComponentId in normalForm) {
            const { appearances = [] } = normalForm[ComponentId]
            const normalizer = new Normalizer()
            normalizer._normalForm = normalForm
            appearances.forEach((appearance, index) => {
                const { contextStack } = appearance
                const reference: NormalReference = { tag, key: ComponentId, index }
                if (!contextStack.find(({ tag }) => (['If', 'Map'].includes(tag)))) {
                    const baseSchema = normalizer.referenceToSchema(reference)
                    if (isSchemaRoom(baseSchema) || isSchemaFeature(baseSchema)) {
                        updateNormal({
                            type: 'put',
                            item: {
                                ...baseSchema,
                                name: (nameSet || !value) ? [] : value.map(componentRenderToSchemaTaggedMessage)
                            },
                            position: { ...normalizer._referenceToInsertPosition(reference), replace: true },
                        })
                        nameSet = true
                    }
                }
            })
        }
    }, [tag, ComponentId, normalForm, updateNormal])
    const changeName = useCallback((event) => {
        setName([{ tag: 'String', value: event.target.value }])
    }, [setName])
    const debouncedName = useDebounce(name, 1000)
    useEffect(() => {
        if (!deepEqual(debouncedName, defaultName)) {
            dispatchNameChange(debouncedName)
        }
    }, [debouncedName, defaultName])
    if (!component) {
        return <Box />
    }
    const componentName = (components[component.key]?.name ?? [{ tag: 'String', value: 'Untitled' }]).map((item) => ((item.tag === 'String') ? item.value : '')).join('')
    return <Box sx={{ width: "100%" }}>
            <LibraryBanner
                primary={componentName}
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
                    label: componentName
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
                    value={nameText}
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
