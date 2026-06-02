import React, { FunctionComponent } from 'react'
import { Box } from '@mui/material'

import { SituationProseFacetPayload } from '@tonylb/mtw-wml/ts/standardize/keys/facets/situationRoom'
import { StandardLiteral } from '@tonylb/mtw-wml/ts/standardize/literal'
import { StandardRender } from '@tonylb/mtw-wml/ts/standardize/render'

import { MakeTheWorldAccordion } from '../../UI'
import StandardRenderEditor from './StandardRender/StandardRenderEditor'
import { TopLevelStandardLiteralEditor } from './StandardLiteral'

export interface SituationFacetRenderFieldsViewProps {
    payload?: SituationProseFacetPayload
    readonly?: boolean
    /** When false, field editors debounce persist (asset / layered mode). Default false under session. */
    debounce?: boolean
    onDisplayNameChange: (value: StandardLiteral) => void
    onSummaryChange: (value: StandardRender) => void
    onDescriptionChange: (value: StandardRender) => void
}

export const SituationFacetRenderFieldsView: FunctionComponent<SituationFacetRenderFieldsViewProps> = ({
    payload,
    readonly = false,
    debounce = true,
    onDisplayNameChange,
    onSummaryChange,
    onDescriptionChange
}) => {
    const emptyRender = new StandardRender([])

    return (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <MakeTheWorldAccordion title="Appearance" defaultExpanded>
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, p: 2 }}>
                    <TopLevelStandardLiteralEditor
                        value={payload?._displayName ?? new StandardLiteral('')}
                        onChange={onDisplayNameChange}
                        label="Display Name"
                        placeholder="Enter a Display Name"
                        size="small"
                        readonly={readonly}
                        debounce={debounce}
                    />
                    <StandardRenderEditor
                        title="Summary"
                        value={payload?._summary ?? emptyRender}
                        onChange={onSummaryChange}
                        validLinkTags={['Feature', 'Knowledge']}
                        toolbar={true}
                        placeholder="Enter a Summary"
                        tag="Summary"
                        debounce={debounce}
                    />
                    <StandardRenderEditor
                        title="Description"
                        value={payload?._description ?? emptyRender}
                        onChange={onDescriptionChange}
                        validLinkTags={['Feature', 'Knowledge']}
                        toolbar={true}
                        placeholder="Enter a Description"
                        tag="Description"
                        debounce={debounce}
                    />
                </Box>
            </MakeTheWorldAccordion>
        </Box>
    )
}

export default SituationFacetRenderFieldsView
