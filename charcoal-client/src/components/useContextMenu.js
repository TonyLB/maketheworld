import { useEffect, useCallback } from "react";

//
// useContextMenu takes a ref and an open command, and overrides the
// context Menu event on that ref to call the open command with the
// event target.
//
export const useContextMenu = (outerRef, openContextMenu) => {

    const current = outerRef && outerRef.current
    const handleContextMenu = useCallback(
        (event) => {
            if (current.contains(event.target)) {
                event.preventDefault();
                openContextMenu(event.target)
            }
        },
        [current, openContextMenu]
    )

    useEffect(() => {
        if (openContextMenu) {
            document.addEventListener("contextmenu", handleContextMenu);
        }
        return () => {
            document.removeEventListener("contextmenu", handleContextMenu);
        };
    }, [openContextMenu, handleContextMenu])

}

export default useContextMenu;