//
// Quantum Render functions will always return PrintMapResult. The following assumptions should apply:
//    - If printMode === naive then the output should be a single line without line breaks
//    - If printMode === nested then the output can be multiline, with the left-most elements
//      snug against the left margin (no global indent ... indent is applied recursively as each
//      parent element incorporates its children)
//    - If printMode === nested then the output can be either a single element or multiple
//      elements
//    - If printMode === propertyNested then the output can represent only a single element (and
//      its children)
//
export enum PrintMode {
    naive,
    nested,
    propertyNested
}

export type PrintMapResult = {
    printMode: PrintMode;
    tag?: string;
    output: string;
}
