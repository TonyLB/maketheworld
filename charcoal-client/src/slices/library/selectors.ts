import { LibraryPublic } from './baseClasses'

export const getLibrary = (library: LibraryPublic): LibraryPublic => {
    const { Assets = [], Characters = [] } = library || {}
    return {
        Assets,
        Characters
    }
}

export type LibrarySelectors = {
    getLibrary: (library: LibraryPublic) => LibraryPublic;
}
