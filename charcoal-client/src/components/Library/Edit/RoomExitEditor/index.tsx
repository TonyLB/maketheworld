import { FunctionComponent, useCallback, useMemo } from "react"
import Box from "@mui/material/Box"
import { useLibraryAsset } from "../LibraryAsset"
import ExitIcon from '@mui/icons-material/CallMade'
import Select, { SelectChangeEvent } from "@mui/material/Select"
import MenuItem from "@mui/material/MenuItem"
import FormControl from "@mui/material/FormControl"
import InputLabel from "@mui/material/InputLabel"
import { TextField } from "@mui/material"
import { useOnboardingCheckpoint } from "../../../Onboarding/useOnboarding"
import { isSchemaExit, isSchemaOutputTag } from "@tonylb/mtw-wml/dist/schema/baseClasses"
import { schemaOutputToString } from '@tonylb/mtw-wml/dist/schema/utils/schemaOutput/schemaOutputToString'
import { treeTypeGuard } from "@tonylb/mtw-wml/dist/tree/filter"
import { isStandardRoom, StandardRoom } from "@tonylb/mtw-wml/dist/standardize/baseClasses"
import SidebarTitle from "../SidebarTitle"
import { ignoreWrapped } from "@tonylb/mtw-wml/dist/schema/utils"
import { StandardFormSchema, useStandardFormContext } from "../StandardFormContext"
import { EditSchema, useEditNodeContext } from "../EditContext"
import ListWithConditions from "../ListWithConditions"

type RoomExitEditorProps = {
    RoomId: string;
    onChange: (value: string) => void;
}

const ExitTargetSelector: FunctionComponent<{ RoomId: string; target: string; inherited?: boolean; onChange: (event: SelectChangeEvent<string>) => void }> = ({ RoomId, target, inherited, onChange }) => {
    const { readonly, standardForm: baseStandardForm, inheritedStandardForm } = useLibraryAsset()
    const standardForm = useMemo(() => (inherited ? inheritedStandardForm : baseStandardForm), [baseStandardForm, inherited, inheritedStandardForm])
    
    const roomNamesInScope = useMemo<Record<string, string>>(() => {
        const roomKeys = Object.values(standardForm.byId).filter(isStandardRoom).map(({ key }) => (key))
        const roomNamesInScope = Object.assign({},
            ...roomKeys
                .map((key) => {
                    if (key === RoomId) {
                        return []
                    }
                    const component = standardForm.byId[key]
                    if (!(component && isStandardRoom(component))) {
                        return []
                    }
                    return [{ [key]: schemaOutputToString(ignoreWrapped(component.shortName)?.children ?? []) || key }]
                }).flat(1)
        )
        return roomNamesInScope
    }, [RoomId, standardForm])
    const onChangeHandler = useCallback((event: SelectChangeEvent<string>) => {
        if (!readonly) {
            onChange(event)
        }
    }, [onChange, readonly])

    return <FormControl sx={{ m: 1, minWidth: 120 }} size="small">
        <InputLabel id="select-small">Target</InputLabel>
        <Select
            sx={{ background: 'white' }}
            labelId="select-small"
            id="select-small"
            value={target in roomNamesInScope ? target : ''}
            label="Target"
            onChange={onChangeHandler}
            disabled={readonly || inherited}
        >
            <MenuItem key='#empty' value=''></MenuItem>
            {
                Object.entries(roomNamesInScope).map(([key, name]) => {
                    return <MenuItem key={key} value={key}>{ name }</MenuItem>
                })
            }
        </Select>
    </FormControl>
}

const EditExit: FunctionComponent<{}> = () => {
    const { readonly, standardForm } = useLibraryAsset()
    const { componentKey } = useStandardFormContext()
    const { data, children, onChange } = useEditNodeContext()

    const nameTree = useMemo(() => (treeTypeGuard({ tree: children, typeGuard: isSchemaOutputTag })), [children])
    const name = useMemo(() => (schemaOutputToString(nameTree)), [nameTree])
    const targetName = useMemo(() => {
        if (!(isSchemaExit(data) && data.to)) {
            return ''
        }
        const targetComponent = standardForm.byId[data.to]
        if (!(targetComponent && isStandardRoom(targetComponent))) {
            return ''
        }
        return schemaOutputToString(ignoreWrapped(targetComponent.shortName)?.children ?? []) ?? targetComponent.key
    }, [data, standardForm])
    useOnboardingCheckpoint('addExit', { requireSequence: true, condition: Boolean(name)})
    useOnboardingCheckpoint('addExitBack', { requireSequence: true, condition: Boolean(isSchemaExit(data) && data.from !== componentKey && name)})
    if (!isSchemaExit(data)) {
        return null
    }
    const targetElement = <ExitTargetSelector
        target={data.to}
        RoomId={data.from}
        onChange={(event) => {
            onChange({ data: { ...data, key: `${data.from}#${event.target.value}`, to: event.target.value }, children: nameTree })
        }}
    />
    return <Box
        sx={{
            width: "calc(100% - 0.5em)",
            display: "inline-flex",
            flexDirection: "row",
            borderRadius: '0.5em',
            padding: '0.1em',
            margin: '0.25em',
            alignItems: "center"
        }}
    >
        <Box sx={{ display: 'flex', marginRight: '0.5em' }} ><ExitIcon sx={{ fill: "grey" }} /></Box>
        <Box sx={{
            display: 'flex',
            minWidth: '12em'
        }}>
            <TextField
                sx={{ background: 'white' }}
                hiddenLabel
                size="small"
                required
                value={name}
                onChange={(event) => { onChange({ data, children: [{ data: { tag: 'String', value: event.target.value }, children: [] }]}) }}
                disabled={readonly}
                placeholder={targetName}
            />
        </Box>
        <Box sx={{ display: 'flex', flexGrow: 1, alignItems: "center" }}>{ targetElement }</Box>
    </Box>
}

export const RoomExitEditor: FunctionComponent<RoomExitEditorProps> = ({ RoomId }) => {
    const { standardForm, updateStandard } = useLibraryAsset()

    const component: StandardRoom = useMemo(() => {
        if (RoomId) {
            const component = standardForm.byId[RoomId]
            if (component && isStandardRoom(component)) {
                return component
            }
        }
        return {
            key: RoomId,
            id: '',
            tag: 'Room',
            exits: [],
            themes: []
        }
    }, [RoomId, standardForm])
    const render = useCallback(() => (<EditExit />), [])

    return <SidebarTitle title="Exits" minHeight="5em">
        <StandardFormSchema componentKey={RoomId} tag="Exits">
            <EditSchema
                value={component?.exits ?? []}
                onChange={(value) => { updateStandard({ type: 'spliceList', componentKey: RoomId, itemKey: 'exits', at: 0, replace: (component?.exits ?? []).length, items: value })}}
            >
                <ListWithConditions
                    render={render}
                    typeGuard={isSchemaExit}
                    label="Exit"
                    defaultNode={{ tag: 'Exit', from: RoomId, to: '', key: `${RoomId}#` }}
                />
            </EditSchema>
        </StandardFormSchema>
    </SidebarTitle>
}

export default RoomExitEditor
