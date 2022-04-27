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

interface FeatureDetailProps {
}

export const FeatureDetail: FunctionComponent<FeatureDetailProps> = () => {
    const { assetKey, normalForm, defaultAppearances, wmlQuery, updateWML, features } = useLibraryAsset()
    const { FeatureId } = useParams<{ FeatureId: string }>()
    const onChange = useCallback((newRender) => {
        let spaceBefore = newRender.length > 0 && newRender[0].tag === 'String' && newRender[0].value.search(/^\s+/) !== -1
        let spaceAfter = newRender.length > 0 && newRender[newRender.length - 1].tag === 'String' && newRender[newRender.length - 1].value.search(/\s+$/) !== -1
        wmlQuery
            .search(`Feature[key="${FeatureId}"]`)
            .not('Condition Feature')
            .add('Description')
            .prop('spaceBefore', spaceBefore, { type: 'boolean' })
            .prop('spaceAfter', spaceAfter, { type: 'boolean' })
            .render(newRender)
        updateWML(wmlQuery.source)
    }, [wmlQuery, updateWML])
    const feature = normalForm[FeatureId || '']
    const [name, setName] = useState(features[feature.key]?.localName || '')

    const dispatchNameChange = useCallback((value) => {
        const roomQuery = wmlQuery.search(`Feature`).not('Condition Feature')
        roomQuery.add(`[key="${FeatureId}"] Name`)
        if (roomQuery) {
            roomQuery.remove()
        }
        if (name) {
            wmlQuery.search(`Feature`)
                .not('Condition Feature')
                .add(`[key="${FeatureId}"]:first`)
                .children()
                .prepend(`<Name>${name}</Name>`)
        }
        updateWML(wmlQuery.source)
    }, [updateWML, wmlQuery, name, FeatureId])
    const onChangeName = useDebouncedCallback(dispatchNameChange)
    const changeName = useCallback((event) => {
        setName(event.target.value)
        onChangeName(event.target.value)
    }, [setName])
    if (!feature || feature.tag !== 'Feature') {
        return <Box />
    }
    return <Box sx={{ width: "100%" }}>
            <LibraryBanner
                primary={features[feature.key]?.name || 'Untitled'}
                secondary={feature.key}
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
                    label: features[feature.key]?.name || 'Untitled'
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
                    { features[feature.key]?.defaultName || '' }
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
                    inheritedRender={features[feature.key]?.defaultRender}
                    render={features[feature.key]?.localRender || []}
                    spaceBefore={features[feature.key]?.spaceBefore}
                    spaceAfter={features[feature.key]?.spaceAfter}
                    onChange={onChange}
                />
            </Box>
        </Box>
}

export default FeatureDetail
