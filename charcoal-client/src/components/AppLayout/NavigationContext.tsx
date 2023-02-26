import React, { FunctionComponent, useCallback, useContext } from "react";
import { useSelector } from "react-redux";
import { useLocation, useNavigate } from "react-router-dom";
import { navigationTabSelected, navigationTabs, navigationTabSelectedIndex, NavigationTab } from "../../slices/UI/navigationTabs";

type NavigationContextType = {
    pathname: string;
    selectedTab: NavigationTab | null;
    previousTab: () => void;
}

const NavigationContext = React.createContext<NavigationContextType>({
    pathname: '',
    selectedTab: null,
    previousTab: () => {}
})

type NavigationContextProviderProps = {

}

export const NavigationContextProvider: FunctionComponent<NavigationContextProviderProps> = ({ children }) => {
    const { pathname } = useLocation()
    const selectedTab = useSelector(navigationTabSelected(pathname))
    const navigationTabData = useSelector(navigationTabs)
    const selectedTabIndex = useSelector(navigationTabSelectedIndex(pathname))
    const navigate = useNavigate()
    const previousTab = useCallback(() => {
        if (selectedTabIndex && selectedTabIndex > 0) {
            const { href } = navigationTabData[selectedTabIndex - 1]
            navigate(href)
        }
        else {
            navigate('/')
        }
    }, [navigationTabData, selectedTabIndex, navigate])
    return (
        <NavigationContext.Provider value={{
            pathname,
            selectedTab,
            previousTab
        }}>
            { children }
        </NavigationContext.Provider>
    )
}

export const useNavigationContext = () => (useContext(NavigationContext))

export default NavigationContextProvider