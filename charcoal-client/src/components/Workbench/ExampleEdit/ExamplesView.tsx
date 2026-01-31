import React, { FunctionComponent, useEffect, useMemo, useState } from 'react'
import { Box, Typography } from '@mui/material'
import { useSelector } from 'react-redux'

import { useWorkbenchAsset } from '../foundations/useWorkbenchAsset'
import { getCurrentComponentId } from '../../../slices/UI/workbench'
import StandardRoom from '@tonylb/mtw-wml/ts/standardize/components/room'
import StandardFeature from '@tonylb/mtw-wml/ts/standardize/components/feature'
import StandardKnowledge from '@tonylb/mtw-wml/ts/standardize/components/knowledge'
import StandardExample from '@tonylb/mtw-wml/ts/standardize/components/example'
import StandardReference from '@tonylb/mtw-wml/ts/standardize/components/reference'
import { ComponentUUID } from '@tonylb/mtw-base/ts/schema'
import { excludeUndefined } from '../../../lib/lists'
import { LayeredExamplesTabs } from '../foundations/LayeredContext'
import ExampleEditor from './ExampleEditor'

export const ExamplesView: FunctionComponent = () => {
    const { standardForm } = useWorkbenchAsset()
    const currentComponentId = useSelector(getCurrentComponentId)

    const parentComponent = useMemo(() => {
        if (!currentComponentId) {
            return undefined
        }
        const component = standardForm.byUniversalId[currentComponentId as ComponentUUID]
        if (component instanceof StandardRoom || component instanceof StandardFeature || component instanceof StandardKnowledge) {
            return component
        }
        return undefined
    }, [currentComponentId, standardForm])

    const siblings = useMemo(() => {
        if (!parentComponent) {
            return []
        }
        return parentComponent.examples
            .payload
            .filter((reference) => (reference instanceof StandardReference))
            .map((reference) => (reference.universalKey))
            .filter(excludeUndefined)
            .map((universalKey) => {
                const example = standardForm.byUniversalId[universalKey as ComponentUUID]
                if (example instanceof StandardExample) {
                    const labelLiteral = example.shortName
                    const label = labelLiteral ? labelLiteral._payload.plain?.toJSON() : null
                    return { id: universalKey as ComponentUUID, label }
                }
                return { id: universalKey as ComponentUUID, label: null }
            })
    }, [parentComponent, standardForm])

    const [currentExampleId, setCurrentExampleId] = useState<ComponentUUID | null>(null)

    //
    // Keep currentExampleId in sync with the siblings list:
    // - when entering the view, default to the first sibling
    // - when siblings change (e.g., add/remove), clamp the current id to a valid sibling
    //
    useEffect(() => {
        if (!siblings.length) {
            setCurrentExampleId(null)
            return
        }
        if (!currentExampleId || !siblings.some(({ id }) => id === currentExampleId)) {
            setCurrentExampleId(siblings[0].id)
        }
    }, [siblings, currentExampleId])

    if (!parentComponent) {
        return (
            <Box sx={{ padding: 2 }}>
                <Typography variant="body2" color="text.secondary">
                    Select a Room, Feature, or Knowledge component to edit its Examples.
                </Typography>
            </Box>
        )
    }

    if (!siblings.length) {
        return (
            <Box sx={{ padding: 2 }}>
                <Typography variant="body2" color="text.secondary">
                    This component has no Examples yet.
                </Typography>
            </Box>
        )
    }

    const activeId = currentExampleId ?? siblings[0].id

    return (
        <Box sx={{ width: '100%', display: 'flex', flexDirection: 'column', flexGrow: 1 }}>
            <LayeredExamplesTabs
                siblings={siblings}
                currentId={activeId}
                onChange={(nextId) => setCurrentExampleId(nextId)}
            >
                <Box sx={{ padding: 2 }}>
                    <ExampleEditor componentId={activeId} />
                </Box>
            </LayeredExamplesTabs>
        </Box>
    )
}

export default ExamplesView
