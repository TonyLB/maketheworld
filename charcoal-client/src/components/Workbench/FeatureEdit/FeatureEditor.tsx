import React, { FunctionComponent, useMemo, useCallback } from 'react'
import { Box } from '@mui/material'

import { useWorkbenchAsset } from '../foundations/useWorkbenchAsset'
import DraftLockout from '../DraftLockout'

import { ComponentUUID } from '@tonylb/mtw-base/ts/schema'
import { useSelector, useDispatch } from 'react-redux'
import { getCurrentComponentId, pushBreadcrumb } from '../../../slices/UI/workbench'
import StandardFeature from '@tonylb/mtw-wml/ts/standardize/components/feature'
import { StandardForm } from '@tonylb/mtw-wml/ts/standardize'
import { StandardLiteral } from '@tonylb/mtw-wml/ts/standardize/literal'
import { ReferenceList } from '@tonylb/mtw-wml/ts/standardize/keys/referenceList'
import { TopLevelStandardLiteralEditor } from '../foundations/StandardLiteral'
import { ReferenceListEditor } from '../foundations/ReferenceList'

export const FeatureEditor: FunctionComponent = () => {
    const dispatch = useDispatch()
    const { standardForm, updateStandard, readonly } = useWorkbenchAsset()
    const currentComponentId = useSelector(getCurrentComponentId)

    const universalKey = useMemo<ComponentUUID | undefined>(() => {
        if (!currentComponentId) return undefined
        return currentComponentId as ComponentUUID
    }, [currentComponentId])

    const feature = useMemo<StandardFeature | undefined>(() => {
        if (!universalKey) return undefined
        const c = standardForm.byUniversalId[universalKey]
        if (c && c instanceof StandardFeature) return c
        return undefined
    }, [universalKey, standardForm])

    const examplesListContext = useCallback(
        (form: StandardForm) => {
            const base = form.byUniversalId[universalKey!]
            if (!base || !(base instanceof StandardFeature)) return null
            const examples = base._payload._examples ?? new ReferenceList([])
            return {
                referenceList: examples,
                setReferenceList: (list: ReferenceList) => {
                    base._payload._examples = list
                }
            }
        },
        [universalKey]
    )

    const handleExamplesItemClick = useCallback(
        (id: string) => {
            if (!feature || readonly) return
            dispatch(pushBreadcrumb({ id: id as ComponentUUID, kind: 'component', componentId: id as ComponentUUID }))
        },
        [feature, readonly, dispatch, universalKey]
    )

    if (!universalKey || !(universalKey in standardForm.byUniversalId) || !feature) {
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
                            value={feature.shortName ?? new StandardLiteral('')}
                            onChange={(newShortName) => {
                                updateStandard({
                                    type: 'update',
                                    update: (incoming: StandardForm) => {
                                        const base = incoming.byUniversalId[universalKey]
                                        if (base instanceof StandardFeature) {
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
                        <Box sx={{ marginTop: '0.5em' }}>
                            <ReferenceListEditor
                                title="Examples"
                                listContext={examplesListContext}
                                tag="Example"
                                disabled={readonly}
                                onItemClick={handleExamplesItemClick}
                            />
                        </Box>
                    </Box>
                </Box>
                <DraftLockout />
            </Box>
        </Box>
    )
}

export default FeatureEditor
