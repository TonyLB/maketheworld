import React, { FunctionComponent, useEffect, useMemo, useState } from 'react'
import { Box, Tabs, Tab, Typography } from '@mui/material'
import { useSelector, useDispatch } from 'react-redux'

import { useWorkbenchAsset } from '../useWorkbenchAsset'
import { getCurrentComponentLayerId, navigateToComponentLayer } from '../../../../slices/UI/workbench'
import StandardRoom from '@tonylb/mtw-wml/ts/standardize/components/room'
import StandardReference from '@tonylb/mtw-wml/ts/standardize/components/reference'
import StandardGuidance from '@tonylb/mtw-wml/ts/standardize/components/guidance'
import { ComponentUUID } from '@tonylb/mtw-base/ts/schema'
import { excludeUndefined } from '../../../../lib/lists'
import GuidanceEditor from '../../GuidanceEdit/GuidanceEditor'

type LayeredGuidanceTabsProps = {
    parentComponentId: ComponentUUID
    currentGuidanceId?: ComponentUUID
}

export const LayeredGuidanceTabs: FunctionComponent<LayeredGuidanceTabsProps> = ({
    parentComponentId,
    currentGuidanceId
}) => {
    const dispatch = useDispatch()
    const { standardForm } = useWorkbenchAsset()
    const currentComponentLayerId = useSelector(getCurrentComponentLayerId) as ComponentUUID | null

    const parentComponent = useMemo(() => {
        const component = standardForm.byUniversalId[parentComponentId]
        if (component && component instanceof StandardRoom) {
            return component
        }
        return null
    }, [parentComponentId, standardForm])

    const siblings = useMemo(() => {
        if (!parentComponent) {
            return []
        }
        return parentComponent.guidance.payload
            .filter((ref): ref is StandardReference => ref instanceof StandardReference)
            .map((ref) => ref.universalKey)
            .filter(excludeUndefined)
            .map((universalKey) => {
                const guidanceComponent = standardForm.byUniversalId[universalKey as ComponentUUID]
                if (guidanceComponent instanceof StandardGuidance) {
                    const labelLiteral = guidanceComponent.shortName
                    const label = labelLiteral ? labelLiteral._payload.plain?.toJSON() : null
                    return { id: universalKey as ComponentUUID, label }
                }
                return { id: universalKey as ComponentUUID, label: null }
            })
    }, [parentComponent, standardForm])

    const [currentId, setCurrentId] = useState<ComponentUUID | null>(() =>
        currentGuidanceId ?? currentComponentLayerId ?? siblings[0]?.id ?? null
    )

    useEffect(() => {
        if (currentGuidanceId !== undefined && currentGuidanceId !== currentId) {
            setCurrentId(currentGuidanceId)
        }
    }, [currentGuidanceId])

    useEffect(() => {
        if (currentComponentLayerId !== undefined && currentComponentLayerId !== null && currentComponentLayerId !== currentId) {
            setCurrentId(currentComponentLayerId)
        }
    }, [currentComponentLayerId])

    useEffect(() => {
        if (!siblings.length) {
            setCurrentId(null)
            return
        }
        if (!currentId || !siblings.some(({ id }) => id === currentId)) {
            setCurrentId(siblings[0].id)
        }
    }, [siblings, currentId])

    const handleTabChange = (_: React.SyntheticEvent, newValue: ComponentUUID) => {
        setCurrentId(newValue)
        dispatch(navigateToComponentLayer(parentComponentId, newValue))
    }

    if (!parentComponent) {
        return null
    }

    if (siblings.length === 0) {
        return (
            <Box sx={{ p: 2 }}>
                <Typography variant="body2" color="text.secondary">
                    No guidance defined. Add guidance in the Room editor.
                </Typography>
            </Box>
        )
    }

    const activeId = currentId ?? siblings[0].id

    return (
        <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
            <Tabs
                value={activeId}
                onChange={handleTabChange}
                variant="scrollable"
                scrollButtons="auto"
                aria-label="Guidance layers"
            >
                {siblings.map(({ id, label }) => (
                    <Tab
                        key={id}
                        value={id}
                        label={label && label.trim().length > 0 ? label : 'Untitled'}
                    />
                ))}
            </Tabs>
            <Box sx={{ flex: 1, overflow: 'auto', mt: 2 }}>
                <GuidanceEditor componentId={activeId} />
            </Box>
        </Box>
    )
}

export default LayeredGuidanceTabs
