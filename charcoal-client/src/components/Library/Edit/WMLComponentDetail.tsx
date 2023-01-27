import { FunctionComponent, useCallback, useEffect, useState, useMemo, Component } from 'react'
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
import { ComponentRenderItem, isNormalFeature, isNormalRoom, NormalReference } from '@tonylb/mtw-wml/dist/normalize/baseClasses'
import Normalizer, { componentRenderToSchemaTaggedMessage } from '@tonylb/mtw-wml/dist/normalize'
import { isSchemaRoom } from '@tonylb/mtw-wml/dist/schema/baseClasses'
import { isSchemaFeature } from '@tonylb/mtw-wml/dist/schema/baseClasses'
import { deepEqual } from '../../../lib/objects'
import DraftLockout from './DraftLockout'

type WMLComponentAppearanceProps = {
    ComponentId: string;
    appearanceIndex: number;
}

const WMLComponentAppearance: FunctionComponent<WMLComponentAppearanceProps> = ({ ComponentId, appearanceIndex }) => {
    const { normalForm, updateNormal, components } = useLibraryAsset()
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
        const normalizer = new Normalizer()
        normalizer._normalForm = normalForm
        const reference: NormalReference = { tag, key: ComponentId, index: appearanceIndex }
        const baseSchema = normalizer.referenceToSchema(reference)
        const position = { ...normalizer._referenceToInsertPosition(reference), replace: true }
        if (isSchemaRoom(baseSchema) || isSchemaFeature(baseSchema)) {
            updateNormal({
                type: 'put',
                item: {
                    ...baseSchema,
                    render: adjustedRender
                },
                position: { ...normalizer._referenceToInsertPosition(reference), replace: true },
            })
        }
    }, [ComponentId, tag, normalForm, updateNormal])
    const defaultName = useMemo(() => {
        const localName = components[ComponentId]?.localName
        if (typeof localName === 'string') {
            return [{ tag: 'String' as 'String', value: localName }]
        }
        if (Array.isArray(localName)) {
            return localName
        }
        return []
    }, [components, ComponentId])
    const appearance = useMemo(() => {
        const component = normalForm[ComponentId]
        if (!(component && (isNormalRoom(component) || isNormalFeature(component)))) {
            return undefined
        }
        return component.appearances[appearanceIndex]
    }, [normalForm, ComponentId, appearanceIndex])
    const [name, setName] = useState(appearance?.name || [])
    const nameText = useMemo<string>(() => ((name || []).map((item) => ((item.tag === 'String') ? item.value : '')).join('')), [name])

    const dispatchNameChange = useCallback((value: ComponentRenderItem[]) => {
        const normalizer = new Normalizer()
        normalizer._normalForm = normalForm
        const reference: NormalReference = { tag, key: ComponentId, index: appearanceIndex }
        const baseSchema = normalizer.referenceToSchema(reference)
        if (isSchemaRoom(baseSchema) || isSchemaFeature(baseSchema)) {
            updateNormal({
                type: 'put',
                item: {
                    ...baseSchema,
                    name: (value || []).map(componentRenderToSchemaTaggedMessage)
                },
                position: { ...normalizer._referenceToInsertPosition(reference), replace: true },
            })
        }
    }, [tag, ComponentId, normalForm, updateNormal])
    const changeName = useCallback((event) => {
        setName([{ tag: 'String', value: event.target.value }])
    }, [setName])
    const debouncedName = useDebounce(name, 1000)
    useEffect(() => {
        if (!deepEqual(debouncedName, appearance?.name || [])) {
            dispatchNameChange(debouncedName)
        }
    }, [debouncedName, appearance])
    if (!component || !appearance) {
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
        <Box
            sx={{
                height: "100%",
                background: 'lightgrey',
                verticalAlign: 'middle',
                display: 'inline'
            }}
        >
            { components[ComponentId]?.defaultName || '' }
        </Box>
        <TextField
            id="name"
            label="Name"
            size="small"
            value={nameText}
            onChange={changeName}
        />
        <Box sx={{ border: `2px solid ${blue[500]}`, borderRadius: '0.5em' }}>
            <DescriptionEditor
                inheritedRender={components[component.key]?.defaultRender}
                render={appearance.render || []}
                onChange={onChange}
            />
        </Box>
        {
            (tag === 'Room') && <RoomExits RoomId={ComponentId || ''} />
        }
    </Box>
}

interface WMLComponentDetailProps {
}

export const WMLComponentDetail: FunctionComponent<WMLComponentDetailProps> = () => {
    const { assetKey, normalForm, components } = useLibraryAsset()
    const { ComponentId } = useParams<{ ComponentId: string }>()
    const component = normalForm[ComponentId || '']
    const { tag } = component || {}
    if (!component || !ComponentId) {
        return <Box />
    }
    const componentName = (components[component.key]?.name ?? [{ tag: 'String', value: 'Untitled' }]).map((item) => ((item.tag === 'String') ? item.value : '')).join('')
    return <Box sx={{ width: "100%", display: 'flex', flexDirection: 'column', flexGrow: 1 }}>
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
        <Box sx={{ flexGrow: 1, position: "relative", width: "100%" }}>
            <Box sx={{ overflowY: 'auto' }}>
                {
                    (component.appearances || []).map(({ contextStack }, index) => {
                        if (contextStack.find(({ tag }) => (['If', 'Map', 'Message'].includes(tag)))) {
                            return null
                        }
                        else {
                            return <WMLComponentAppearance key={`${ComponentId}-appearance-${index}`} ComponentId={ComponentId} appearanceIndex={index} />
                        }
                    })
                }
            </Box>
            <DraftLockout />
        </Box>
    </Box>
}

export default WMLComponentDetail
