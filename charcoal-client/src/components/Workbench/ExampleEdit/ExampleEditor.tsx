import React, { FunctionComponent, useMemo, useState } from "react"
import { useWorkbenchAsset } from "../foundations/useWorkbenchAsset"
import StandardExample from "@tonylb/mtw-wml/ts/standardize/components/example";
import { Box, Button, TextField, Typography } from "@mui/material";
import { useDebouncedOnChange } from "../../../hooks/useDebounce";
import { StandardRender } from "@tonylb/mtw-wml/ts/standardize/render";
import { StandardForm } from "@tonylb/mtw-wml/ts/standardize";
import { StandardRenderEditor } from "../foundations/StandardRender";
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
    const [name, setName] = useState((component.displayName ?? new StandardRender([])).plainString)
    useDebouncedOnChange({
        value: name,
        delay: 1000,
        onChange: (value) => {
            updateStandard({
                type: 'update',
                update: (example: StandardForm) => {
                    const newValue = example.byUniversalId[componentId]
                    if (newValue instanceof StandardExample) {
                        newValue._payload._displayName = new StandardRender([value])
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
        value: description,
        delay: 1000,
        onChange: (value: StandardRender) => {
            updateStandard({
                type: 'update',
                update: (example: StandardForm) => {
                    const newValue = example.byUniversalId[componentId]
                    if (newValue instanceof StandardExample) {
                        newValue._payload._description = value
                    }
                    return example
                }
            })
        }
    })

    return (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            {inherited && (
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                    <Typography variant="body2" color="text.secondary">
                        Inherited from another asset
                    </Typography>
                    <Button size="small" variant="outlined" onClick={() => {}}>
                        Unlock for editing
                    </Button>
                </Box>
            )}
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
        </Box>
    )
}

export default ExampleEditor
