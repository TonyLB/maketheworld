import React, { FunctionComponent, useMemo } from 'react'
import { Box } from '@mui/material'

import { useWorkbenchAsset } from '../foundations/useWorkbenchAsset'
import { ComponentUUID } from '@tonylb/mtw-base/ts/schema'
import { useSelector } from 'react-redux'
import { getCurrentComponentId } from '../../../slices/UI/workbench'
import StandardKnowledge from '@tonylb/mtw-wml/ts/standardize/components/knowledge'
import { StandardForm } from '@tonylb/mtw-wml/ts/standardize'
import { StandardLiteral } from '@tonylb/mtw-wml/ts/standardize/literal'
import { TopLevelStandardLiteralEditor } from '../foundations/StandardLiteral'
import DefaultRenderEditor from '../foundations/DefaultRenderEditor'
import Spacer from '../WorkbenchSpacer'

export const KnowledgeEditor: FunctionComponent = () => {
    const { standardForm, updateStandard, readonly } = useWorkbenchAsset()
    const currentComponentId = useSelector(getCurrentComponentId)

    const universalKey = useMemo<ComponentUUID | undefined>(() => {
        if (!currentComponentId) return undefined
        return currentComponentId as ComponentUUID
    }, [currentComponentId])

    const knowledge = useMemo<StandardKnowledge | undefined>(() => {
        if (!universalKey) return undefined
        const c = standardForm.byUniversalId[universalKey]
        if (c && c instanceof StandardKnowledge) return c
        return undefined
    }, [universalKey, standardForm])

    if (!universalKey || !(universalKey in standardForm.byUniversalId) || !knowledge) {
        return <Box />
    }

    return (
        <Box sx={{ width: "100%", display: 'flex', flexDirection: 'column', flexGrow: 1 }}>
            <Box sx={{ flexGrow: 1, position: "relative", width: "100%", overflowY: 'auto' }}>
                <Box sx={{ padding: 2 }}>
                    <Box sx={{
                        marginLeft: '0.5em',
                        marginTop: '0.5em',
                        display: 'flex',
                        flexDirection: 'column',
                        rowGap: '0.25em',
                        width: "calc(100% - 0.5em)",
                        position: 'relative'
                    }}>
                        <TopLevelStandardLiteralEditor
                            value={knowledge.shortName ?? new StandardLiteral('')}
                            onChange={(newShortName) => {
                                updateStandard({
                                    type: 'update',
                                    update: (incoming: StandardForm) => {
                                        const base = incoming.byUniversalId[universalKey]
                                        if (base instanceof StandardKnowledge) {
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
                        <DefaultRenderEditor parentId={universalKey} />
                    </Box>
                </Box>
            </Box>
        </Box>
    )
}

export default KnowledgeEditor
