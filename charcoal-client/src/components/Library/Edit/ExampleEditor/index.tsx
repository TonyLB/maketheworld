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
import { useDispatch } from "react-redux";
import StandardRoom from "@tonylb/mtw-wml/ts/standardize/components/room";
import StandardFeature from "@tonylb/mtw-wml/ts/standardize/components/feature";
import StandardKnowledge from "@tonylb/mtw-wml/ts/standardize/components/knowledge";
import StandardReference from "@tonylb/mtw-wml/ts/standardize/components/reference";
import { ImportItemContent } from "@tonylb/mtw-wml/ts/standardize/components/metaData";

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

    const localizeExample = useCallback(() => {
        console.log(`localStandardForm[${componentId}]: ${JSON.stringify(localStandardForm.toJSON(), null, 4)}`)
        if (!(componentId in localStandardForm.byId)) {
            const parentId = componentId.split('.').slice(0, -1).join('.')
            updateStandard({
                type: 'update',
                update: (draft) => {
                    const parent = draft._byId[parentId]
                    const parentImportAsset = parent?.import?.assetId
                    if (
                        parentImportAsset &&
                        (parent instanceof StandardRoom || parent instanceof StandardFeature || parent instanceof StandardKnowledge)
                    ) {
                        draft._byId[componentId] = new StandardExample(componentId).withImport(new ImportItemContent(parentImportAsset, componentId))
                        parent._payload._examples.push(new StandardReference({ key: componentId.split('.').slice(-1).join('.'), tag: 'Example' }))
                        console.log(`Example references: ${JSON.stringify(parent._payload._examples, null, 4)}`)
                    }
                    return draft
                }
            })
        }
    }, [componentId, localStandardForm, updateStandard])
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
