import React, { DragEvent, FunctionComponent, ReactChild, ReactChildren, useCallback, useContext, useState } from 'react'

type FileWrapperContextType = {
    dragActive: boolean;
}

const FileWrapperContext = React.createContext<FileWrapperContextType>({
    dragActive: false,
})

type FileWrapperProps = {
    fileTypes: string[];
    onDrop?: (file: File) => void;
    children?: ReactChild | ReactChildren;
}

export const FileWrapper: FunctionComponent<FileWrapperProps> = ({ onDrop= () => {}, fileTypes, children }) => {
    const [dragActive, setDragActive] = useState<boolean>(false)

    const handleDrag = useCallback((event: DragEvent) => {
        event.preventDefault()
        event.stopPropagation()
        if (event.type === "dragenter" || event.type === "dragover") {
            setDragActive(true)
        }
        else if (event.type === "dragleave") {
            setDragActive(false)
        }
        else if (event.type === "drop") {
            setDragActive(false)
            if (event.dataTransfer?.files && fileTypes.includes(event.dataTransfer.files[0]?.type)) {
                onDrop(event.dataTransfer.files[0])
            }
        }
    }, [setDragActive, onDrop])

    return <FileWrapperContext.Provider value={{
        dragActive
    }}>
        <form
            id="loadImage"
            style={{
                position: "relative"
            }}
            onDragEnter={handleDrag}
            onDragLeave={handleDrag}
            onDragOver={handleDrag}
            onDrop={handleDrag}
        >
            <input type="file" id="image-load-input" style={{ display: 'none' }} />
            <label
                id="image-load-label"
                htmlFor="image-load-input"
                style={{ height: "100%" }}
            >
                { children }
            </label>
            { dragActive && <div
                style={{
                    width: "100%",
                    height: "100%",
                    top: "0px",
                    bottom: "0px",
                    right: "0px",
                    left: "0px"
                }}
                onDragEnter={handleDrag}
                onDragLeave={handleDrag}
                onDragOver={handleDrag}
            />}
        </form>
    </FileWrapperContext.Provider>
}

export default FileWrapper

export const useFileWrapper = () => (useContext(FileWrapperContext))
