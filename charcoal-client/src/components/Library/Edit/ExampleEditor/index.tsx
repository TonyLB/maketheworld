import React, { FunctionComponent, useCallback, useMemo, useState } from "react"
import { useLibraryAsset } from "../LibraryAsset"
import StandardExample from "@tonylb/mtw-wml/ts/standardize/components/example";
import { Box, IconButton, TextField } from "@mui/material";
import LockIcon from '@mui/icons-material/Lock';
import LockOpenIcon from '@mui/icons-material/LockOpen';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import { useDebouncedOnChange } from "../../../../hooks/useDebounce";
import { StandardRender } from "@tonylb/mtw-wml/ts/standardize/render";
import { StandardForm } from "@tonylb/mtw-wml/ts/standardize";
import StandardRenderEditor from "../StandardRenderEditor";
import SidebarTitledBox from "../SidebarTitledBox";
import StandardRoom from "@tonylb/mtw-wml/ts/standardize/components/room";
import StandardFeature from "@tonylb/mtw-wml/ts/standardize/components/feature";
import StandardKnowledge from "@tonylb/mtw-wml/ts/standardize/components/knowledge";
import StandardReference from "@tonylb/mtw-wml/ts/standardize/components/reference";
import { ComponentUUID } from "@tonylb/mtw-base/ts/schema";

type ExampleEditorProps = {
    componentId: ComponentUUID;
}

export const ExampleEditor: FunctionComponent<ExampleEditorProps> = ({ componentId }) => {
    const { standardForm, localStandardForm, updateStandard } = useLibraryAsset()
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
        console.log(`localStandardForm[${componentId}]: ${JSON.stringify(localStandardForm.toJSON(), null, 4)}`)
        if (!(componentId in localStandardForm.byUniversalId)) {
            // Find parent components that reference this example
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
                    // Add the example component
                    draft._components = [...draft._components, new StandardExample(componentId)]
                    // Add references to parent components that have this example
                    parentIds.forEach((parentId) => {
                        const parent = draft.byUniversalId[parentId as ComponentUUID]
                        if (parent instanceof StandardRoom || parent instanceof StandardFeature || parent instanceof StandardKnowledge) {
                            parent._payload._examples = parent._payload._examples.assureItem(new StandardReference({ universalKey: componentId }))
                            console.log(`Example references: ${JSON.stringify(parent._payload._examples, null, 4)}`)
                        }
                    })
                    if (parentIds.length === 0) {
                        console.log(`Example without parent: ${JSON.stringify(draft._components, null, 4)}`)
                    }
                    return draft
                }
            })
        }
    }, [componentId, localStandardForm, standardForm, updateStandard])
    return <SidebarTitledBox title="Example" sidebarTitle="Inherited" sidebar={inherited} minHeight="5em">
        <Box sx={{
            display: 'flex',
            flexDirection: 'row',
            flexGrow: 1
        }}>
            <Box sx={{
                flexGrow: 1
            }}>
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
            </Box>
            <Box sx={{
                width: '5em',
                display: 'flex',
                flexDirection: 'column'
            }}>
                <IconButton>
                    { inherited ? <LockIcon /> : <LockOpenIcon /> }
                </IconButton>
                <IconButton onClick={localizeExample}>
                    <EditIcon />
                </IconButton>
                {
                    !inherited &&
                    <IconButton>
                        <DeleteIcon />
                    </IconButton>
                }
            </Box>
        </Box>
    </SidebarTitledBox>
}

export default ExampleEditor
