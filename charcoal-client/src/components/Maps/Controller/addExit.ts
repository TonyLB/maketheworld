import { StandardForm } from "@tonylb/mtw-wml/ts/standardize"
import { UpdateStandardPayload } from "../../../slices/personalAssets/reducers";

export const addExitFactory = ({ standardForm, editable, addImport, updateStandard }: {
    standardForm: StandardForm,
    editable: StandardForm,
    addImport: (key: `ROOM#${string}`) => void,
    updateStandard: (action: UpdateStandardPayload) => void
}) => ({ to, from }: { to: `ROOM#${string}`; from: `ROOM#${string}` }) => {
    // Room-local exit authoring was removed in asset mode (M6). Topology edges belong on
    // Area ludicGraph.edges; use the Workbench Area editor instead. Map exit drag tools
    // remain visible for UX continuity but do not mutate the Redux asset draft.
    void standardForm
    void editable
    void addImport
    void updateStandard
    void to
    void from
}
