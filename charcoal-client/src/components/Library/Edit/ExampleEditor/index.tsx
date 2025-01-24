import React, { FunctionComponent, useMemo } from "react"
import TitledBox from "../../../TitledBox"
import { useLibraryAsset } from "../LibraryAsset"
import StandardExample from "@tonylb/mtw-wml/ts/standardize/components/example";
import DescriptionEditor from "../DescriptionEditor";
import { EditSchema } from "../EditContext";
import { Box } from "@mui/material";

type ExampleEditorProps = {
    componentId: string;
}

export const ExampleEditor: FunctionComponent<ExampleEditorProps> = ({ componentId }) => {
    const { standardForm } = useLibraryAsset()
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
    console.log(`component: ${JSON.stringify(component.toJSON(), null, 4)}`)
    return <TitledBox title="Example">
        <EditSchema
            value={component.name ?? []}
            onChange={(value) => {}}
        >
            <DescriptionEditor
                validLinkTags={[]}
                toolbar={false}
                
            />
        </EditSchema>
        <Box
            sx={{
                backgroundColor: 'lightgray',
                paddingTop: '0.5em',
                paddingBottom: '0.5em',
                width: '100%'
            }}
        >
            <EditSchema
                value={component.summary ?? []}
                onChange={(value) => {}}
            >
                <DescriptionEditor
                    validLinkTags={[]}
                    toolbar={false}
                    
                />
            </EditSchema>
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
