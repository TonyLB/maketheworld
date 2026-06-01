import React, { FunctionComponent, useMemo } from 'react'
import { Box } from '@mui/material'
import { useSelector } from 'react-redux'
import { ComponentUUID } from '@tonylb/mtw-base/ts/schema'
import StandardArea from '@tonylb/mtw-wml/ts/standardize/components/area'
import { StandardForm } from '@tonylb/mtw-wml/ts/standardize'
import { StandardLiteral } from '@tonylb/mtw-wml/ts/standardize/literal'
import { getCurrentComponentId } from '../../../slices/UI/workbench'
import { useWorkbenchAsset } from '../foundations/useWorkbenchAsset'
import { TopLevelStandardLiteralEditor } from '../foundations/StandardLiteral'
import Spacer from '../WorkbenchSpacer'
import PositionGraphNodesEditor from './PositionGraphNodesEditor'
import ExitEdgeListEditor from './ExitEdgeListEditor'

export const AreaEditor: FunctionComponent = () => {
    const { standardForm, updateStandard } = useWorkbenchAsset()
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
                        <TopLevelStandardLiteralEditor
                            value={area.shortName ?? new StandardLiteral('')}
                            onChange={(newShortName) => {
                                updateStandard({
                                    type: 'update',
                                    update: (incoming: StandardForm) => {
                                        const base = incoming.byUniversalId[universalKey]
                                        if (base instanceof StandardArea) {
                                            base._payload._shortName = newShortName
                                        }
                                        return incoming
                                    }
                                })
                            }}
                            label="Short Name"
                            placeholder="Enter short name..."
                            size="small"
                        />
                        <Spacer />
                        <PositionGraphNodesEditor AreaId={universalKey} />
                        <Spacer />
                        <ExitEdgeListEditor AreaId={universalKey} />
                    </Box>
                </Box>
            </Box>
        </Box>
    )
}

export default AreaEditor
