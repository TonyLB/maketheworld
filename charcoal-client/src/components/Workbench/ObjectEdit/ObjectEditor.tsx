import React, { FunctionComponent, useMemo } from 'react'
import { Box } from '@mui/material'
import { useSelector } from 'react-redux'

import { useWorkbenchAsset } from '../foundations/useWorkbenchAsset'
import { ComponentUUID } from '@tonylb/mtw-base/ts/schema'
import { getCurrentComponentId } from '../../../slices/UI/workbench'
import StandardObject from '@tonylb/mtw-wml/ts/standardize/components/object'
import type { StandardComponent } from '@tonylb/mtw-wml/ts/standardize/components/baseClasses'
import {
    WorkbenchComponentProvider,
    WorkbenchShortNameField,
    WorkbenchGlossField
} from '../foundations/WorkbenchComponent'

const objectGuard = (
    component: StandardComponent | undefined
): component is StandardObject => component instanceof StandardObject

export const ObjectEditorBody: FunctionComponent = () => (
    <Box sx={{
        marginLeft: '0.5em',
        marginTop: '0.5em',
        display: 'flex',
        flexDirection: 'column',
        rowGap: '0.25em',
        width: "calc(100% - 0.5em)",
        position: 'relative'
    }}>
        <WorkbenchShortNameField />
        <WorkbenchGlossField />
    </Box>
)

export const ObjectEditor: FunctionComponent = () => {
    const { standardForm } = useWorkbenchAsset()
    const currentComponentId = useSelector(getCurrentComponentId)

    const universalKey = useMemo<ComponentUUID | undefined>(() => {
        if (!currentComponentId) return undefined
        return currentComponentId as ComponentUUID
    }, [currentComponentId])

    const object = useMemo<StandardObject | undefined>(() => {
        if (!universalKey) return undefined
        const c = standardForm.byUniversalId[universalKey]
        if (c && c instanceof StandardObject) return c
        return undefined
    }, [universalKey, standardForm])

    if (!universalKey || !(universalKey in standardForm.byUniversalId) || !object) {
        return <Box />
    }

    return (
        <WorkbenchComponentProvider
            componentId={universalKey}
            guard={objectGuard}
        >
            <Box sx={{ width: "100%", display: 'flex', flexDirection: 'column', flexGrow: 1 }}>
                <Box sx={{ flexGrow: 1, position: "relative", width: "100%", overflowY: 'auto' }}>
                    <Box sx={{ padding: 2 }}>
                        <ObjectEditorBody />
                    </Box>
                </Box>
            </Box>
        </WorkbenchComponentProvider>
    )
}

export default ObjectEditor
