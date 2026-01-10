import React, { FunctionComponent, ReactNode, useContext } from "react"

type StandardFormContextType = {
    componentKey: string;
    tag: 'ShortName' | 'Name' | 'Summary' | 'Description' | 'Statement' | 'Fallthrough' | 'If' | 'Exits';
    children?: ReactNode;
}

const StandardFormContext = React.createContext<StandardFormContextType>({
    componentKey: '',
    tag: 'Name',
})

export const StandardFormSchema: FunctionComponent<StandardFormContextType> = ({ componentKey, tag, children }) => {
    return <StandardFormContext.Provider value={{ componentKey, tag }}>
        { children }
    </StandardFormContext.Provider>
}

export const useStandardFormContext = () => (useContext(StandardFormContext))
