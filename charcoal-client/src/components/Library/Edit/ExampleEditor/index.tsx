import React, { FunctionComponent, useMemo, useState } from "react"
import TitledBox from "../../../TitledBox"
import { useLibraryAsset } from "../LibraryAsset"
import StandardExample from "@tonylb/mtw-wml/ts/standardize/components/example";
import DescriptionEditor from "../DescriptionEditor";
import { EditSchema } from "../EditContext";
import { Box, TextField } from "@mui/material";
import useDebounce, { useDebouncedOnChange } from "../../../../hooks/useDebounce";
import { StandardRender } from "@tonylb/mtw-wml/ts/standardize/render";
import { StandardForm } from "@tonylb/mtw-wml/ts/standardize";
import StandardRenderEditor from "../StandardRenderEditor";

type ExampleEditorProps = {
    componentId: string;
}

export const ExampleEditor: FunctionComponent<ExampleEditorProps> = ({ componentId }) => {
    const { standardForm, updateStandard } = useLibraryAsset()
    const component = useMemo<StandardExample>(() => {
        const component = standardForm.byId[componentId]
        if (component && component instanceof StandardExample) {
            return component
        }
        return new StandardExample({
            key: componentId,
            tag: 'Example'
        })
    }, [standardForm, componentId])
    const [name, setName] = useState((new StandardRender(component.name ?? [])).plainString)
    useDebouncedOnChange({
        value: name,
        delay: 1000,
        onChange: (value) => {
            updateStandard({
                type: 'update',
                update: (example: StandardForm) => {
                    const newValue = example.byId[componentId]
                    if (newValue instanceof StandardExample) {
                        newValue._payload._name = new StandardRender([value])
                    }
                    return example
                }
            })
        }
    })
    const [summary, setSummary] = useState(new StandardRender(component.summary ?? []))
    useDebouncedOnChange({
        value: summary,
        delay: 1000,
        onChange: (value: StandardRender) => {
            updateStandard({
                type: 'update',
                update: (example: StandardForm) => {
                    const newValue = example.byId[componentId]
                    if (newValue instanceof StandardExample) {
                        newValue._payload._summary = value
                    }
                    return example
                }
            })
        }
    })
    return <TitledBox title="Example">
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
            />
        </Box>
        <EditSchema
            value={component.description ?? []}
            onChange={(value) => {}}
        >
            <DescriptionEditor
                validLinkTags={[]}
                toolbar={false}
                
            />
        </EditSchema>
    </TitledBox>
}

export default ExampleEditor
