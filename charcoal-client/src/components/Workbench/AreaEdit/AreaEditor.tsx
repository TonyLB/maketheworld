import React, { FunctionComponent, useMemo } from 'react'
import { Box } from '@mui/material'
import { useSelector } from 'react-redux'
import { ComponentUUID } from '@tonylb/mtw-base/ts/schema'
import StandardArea from '@tonylb/mtw-wml/ts/standardize/components/area'
import { getCurrentComponentId } from '../../../slices/UI/workbench'
import { useWorkbenchAsset } from '../foundations/useWorkbenchAsset'
import {
    WorkbenchComponentProvider,
    WorkbenchShortNameField
} from '../foundations/WorkbenchComponent'
import Spacer from '../WorkbenchSpacer'
import PositionGraphNodesEditor from './PositionGraphNodesEditor'
import ExitEdgeListEditor from './ExitEdgeListEditor'

export const AreaEditor: FunctionComponent = () => {
    const { standardForm } = useWorkbenchAsset()
    const currentComponentId = useSelector(getCurrentComponentId)

    const universalKey = useMemo<ComponentUUID | undefined>(() => {
        if (!currentComponentId) {
            return undefined
        }
        return currentComponentId as ComponentUUID
    }, [currentComponentId])

    const area = useMemo<StandardArea | undefined>(() => {
        if (!universalKey) {
            return undefined
        }
        const component = standardForm.byUniversalId[universalKey]
        if (component instanceof StandardArea) {
            return component
        }
        return undefined
    }, [universalKey, standardForm])

    if (!universalKey || !area) {
        return <Box />
    }

    return (
        <WorkbenchComponentProvider
            componentId={universalKey}
            guard={(c): c is StandardArea => c instanceof StandardArea}
        >
            <Box sx={{ width: '100%', display: 'flex', flexDirection: 'column', flexGrow: 1 }}>
                <Box sx={{ flexGrow: 1, position: 'relative', width: '100%', overflowY: 'auto' }}>
                    <Box sx={{ padding: 2 }}>
                        <Box
                            sx={{
                                marginLeft: '0.5em',
                                marginTop: '0.5em',
                                display: 'flex',
                                flexDirection: 'column',
                                rowGap: '0.25em',
                                width: 'calc(100% - 0.5em)',
                                position: 'relative'
                            }}
                        >
                            <WorkbenchShortNameField />
                            <Spacer />
                            <PositionGraphNodesEditor AreaId={universalKey} />
                            <Spacer />
                            <ExitEdgeListEditor AreaId={universalKey} />
                        </Box>
                    </Box>
                </Box>
            </Box>
        </WorkbenchComponentProvider>
    )
}

export default AreaEditor
