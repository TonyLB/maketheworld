import React, { FunctionComponent, useCallback, useMemo, useState } from "react"
import { useWorkbenchAsset } from "../foundations/useWorkbenchAsset"
import StandardExample from "@tonylb/mtw-wml/ts/standardize/components/example";
import { Box, IconButton, TextField } from "@mui/material";
import LockIcon from '@mui/icons-material/Lock';
import LockOpenIcon from '@mui/icons-material/LockOpen';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import { useDebouncedOnChange } from "../../../hooks/useDebounce";
import { StandardRender } from "@tonylb/mtw-wml/ts/standardize/render";
import { StandardForm } from "@tonylb/mtw-wml/ts/standardize";
import { StandardRenderEditor } from "../foundations/StandardRender";
import { MakeTheWorldAccordion } from "../../UI";
import StandardRoom from "@tonylb/mtw-wml/ts/standardize/components/room";
import StandardFeature from "@tonylb/mtw-wml/ts/standardize/components/feature";
import StandardKnowledge from "@tonylb/mtw-wml/ts/standardize/components/knowledge";
import StandardReference from "@tonylb/mtw-wml/ts/standardize/components/reference";
import { ComponentUUID } from "@tonylb/mtw-base/ts/schema";

type ExampleEditorProps = {
    componentId: ComponentUUID;
}

export const ExampleEditor: FunctionComponent<ExampleEditorProps> = ({ componentId }) => {
    const { standardForm, localStandardForm, updateStandard } = useWorkbenchAsset()
    const component = useMemo<StandardExample>(() => {
        const component = standardForm.byUniversalId[componentId]
        if (component && component instanceof StandardExample) {
            return component
        }
        return new StandardExample({
            universalKey: componentId,
            tag: 'Example'
        })
    }, [standardForm, componentId])
    const inherited = !Boolean(localStandardForm.byUniversalId[componentId])
    const [name, setName] = useState((component.name ?? new StandardRender([])).plainString)
    useDebouncedOnChange({
        value: name,
        delay: 1000,
        onChange: (value) => {
            updateStandard({
                type: 'update',
                update: (example: StandardForm) => {
                    const newValue = example.byUniversalId[componentId]
                    if (newValue instanceof StandardExample) {
                        newValue._payload._name = new StandardRender([value])
                    }
                    return example
                }
            })
        }
    })
    const [summary, setSummary] = useState(component.summary ?? new StandardRender([]))
    useDebouncedOnChange({
        value: summary,
        delay: 1000,
        onChange: (value: StandardRender) => {
            updateStandard({
                type: 'update',
                update: (example: StandardForm) => {
                    const newValue = example.byUniversalId[componentId]
                    if (newValue instanceof StandardExample) {
                        newValue._payload._summary = value
                    }
                    return example
                }
            })
        }
    })
    const [description, setDescription] = useState(component.description ?? new StandardRender([]))
    useDebouncedOnChange({
        value: summary,
        delay: 1000,
        onChange: (value: StandardRender) => {
            updateStandard({
                type: 'update',
                update: (example: StandardForm) => {
                    const newValue = example.byId[componentId]
                    if (newValue instanceof StandardExample) {
                        newValue._payload._description = value
                    }
                    return example
                }
            })
        }
    })

    const localizeExample = useCallback(() => {
        if (!(componentId in localStandardForm.byUniversalId)) {
            const parentIds: string[] = []
            Object.values(standardForm.byId).forEach((component) => {
                if (component instanceof StandardRoom || component instanceof StandardFeature || component instanceof StandardKnowledge) {
                    const hasExample = component.examples.payload.some((ref) =>
                        ref instanceof StandardReference && ref.universalKey === componentId
                    )
                    if (hasExample && component.universalKey) {
                        parentIds.push(component.universalKey)
                    }
                }
            })
            updateStandard({
                type: 'updateLocal',
                update: (draft) => {
                    draft._components = [...draft._components, new StandardExample(componentId)]
                    parentIds.forEach((parentId) => {
                        const parent = draft.byUniversalId[parentId as ComponentUUID]
                        if (parent instanceof StandardRoom || parent instanceof StandardFeature || parent instanceof StandardKnowledge) {
                            parent._payload._examples = parent._payload._examples.assureItem(new StandardReference({ universalKey: componentId }))
                        }
                    })
                    return draft
                }
            })
        }
    }, [componentId, localStandardForm, standardForm, updateStandard])
    return (
        <MakeTheWorldAccordion
            title="Example"
            defaultExpanded
            icon={inherited ? <LockIcon /> : <LockOpenIcon />}
            actions={
                <Box sx={{ display: 'flex', gap: 0.5 }}>
                    <IconButton onClick={localizeExample} size="small">
                        <EditIcon />
                    </IconButton>
                    {!inherited && (
                        <IconButton size="small">
                            <DeleteIcon />
                        </IconButton>
                    )}
                </Box>
            }
        >
            <TextField
                value={name}
                onChange={(event) => { setName(event.target.value) }}
            />
            <Box
                sx={{
                    backgroundColor: 'lightgray',
                    paddingTop: '0.5em',
                    paddingBottom: '0.5em',
                    width: '100%'
                }}
            >
                <StandardRenderEditor
                    value={summary}
                    onChange={setSummary}
                    validLinkTags={[]}
                    toolbar={false}
                    tag="Summary"
                />
            </Box>
            <StandardRenderEditor
                value={description}
                onChange={setDescription}
                validLinkTags={[]}
                toolbar={false}
                tag="Description"
            />
        </MakeTheWorldAccordion>
    )
}

export default ExampleEditor
