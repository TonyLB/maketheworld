import { StandardForm } from "@tonylb/mtw-wml/ts/standardize"

export const stripImportAndExport = (standard: StandardForm): StandardForm => {
    return new StandardForm(standard.toNDJSON().map((component) => ({ ...component, from: undefined, exportAs: undefined })))
}
