import React, { FunctionComponent, useMemo, useState } from "react"
import TitledBox from "../../../TitledBox"
import { useLibraryAsset } from "../LibraryAsset"
import StandardExample from "@tonylb/mtw-wml/ts/standardize/components/example";
import { Box, TextField } from "@mui/material";
import { useDebouncedOnChange } from "../../../../hooks/useDebounce";
import { StandardRender } from "@tonylb/mtw-wml/ts/standardize/render";
import { StandardForm } from "@tonylb/mtw-wml/ts/standardize";
import StandardRenderEditor from "../StandardRenderEditor";
import SidebarTitle from "../SidebarTitle";
import SidebarTitledBox from "../SidebarTitledBox";

type ExampleEditorProps = {
    componentId: string;
}

export const ExampleEditor: FunctionComponent<ExampleEditorProps> = ({ componentId }) => {
    const { standardForm, localStandardForm, updateStandard } = useLibraryAsset()
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
    const inherited = !Boolean(localStandardForm.byId[componentId])
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
    const [description, setDescription] = useState(new StandardRender(component.description ?? []))
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
    return <SidebarTitledBox title="Example" sidebarTitle="Inherited" sidebar={inherited} minHeight="5em">
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
        <StandardRenderEditor
            value={description}
            onChange={setDescription}
            validLinkTags={[]}
            toolbar={false}
        />
    </SidebarTitledBox>
}

export default ExampleEditor
