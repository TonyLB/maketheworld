export class AssetWorkspaceException extends Error {
    constructor(message: string) {
        super(message)
        this.name = 'AssetWorkspaceException'
    }
}
