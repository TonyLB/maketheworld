import React, { DragEvent, FunctionComponent, ReactChild, ReactChildren, useCallback, useContext, useRef, useState } from 'react'

type FileWrapperContextType = {
    dragActive: boolean;
    openUpload: (event: React.MouseEvent<HTMLElement | SVGSVGElement>) => void;
}

const FileWrapperContext = React.createContext<FileWrapperContextType>({
    dragActive: false,
    openUpload: () => {}
})

type FileWrapperProps = {
    fileTypes: string[];
    onFile?: (file: File) => void;
    children?: ReactChild | ReactChildren;
}

export const FileWrapper: FunctionComponent<FileWrapperProps> = ({ onFile: onDrop= () => {}, fileTypes, children }) => {
    const ref = useRef<HTMLInputElement>(null)
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

    const handleChange = useCallback((event) => {
        if (event.currentTarget.files && fileTypes.includes(event.currentTarget.files[0]?.type)) {
            onDrop(event.currentTarget.files[0])
        }
    }, [onDrop])

    const openUpload = useCallback((event: React.MouseEvent<HTMLElement | SVGSVGElement>) => {
        event.preventDefault()
        event.stopPropagation()
        if (ref.current) {
            ref.current.click()
        }
    }, [ref])

    return <FileWrapperContext.Provider value={{
        dragActive,
        openUpload
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
            <input
                type="file"
                id="image-load-input"
                accept={fileTypes.join(', ')}
                onChange={handleChange}
                style={{ display: 'none' }}
                ref={ref}
                onClick={(event) => {
                    event.stopPropagation()
                }}
            />
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
