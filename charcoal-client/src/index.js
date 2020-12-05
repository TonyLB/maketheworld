import React from 'react';
import ReactDOM from 'react-dom';
import './index.css';
import App from './App';
import * as serviceWorker from './serviceWorker';

//
// We need to directly measure the viewport height, for compatibility with mobile browsers
// that deliver the "vh" CSS variable oddly.
//
// This variable will, in turn, be used in the Layout/index.css file, to provide a reliable
// full-height measurement to scale content to the window.
//

    // First we get the viewport height and we multiple it by 1% to get a value for a vh unit
    let vh = window.innerHeight * 0.01;
    // Then we set the value in the --vh custom property to the root of the document
    document.documentElement.style.setProperty('--vh', vh.toString() + 'px');

    // We listen to the resize and orientation-changed events

    const listenerFunction = () => {
        //
        // We execute the same script as before
        //
        let vh = window.innerHeight * 0.01;
        document.documentElement.style.setProperty('--vh', vh.toString() + 'px');
        //
        // And make sure that the resize has not scrolled the window (since we
        // want a perfect fit)
        //
        window.scroll(0, 0)
    }
    //
    // Because the measure is not always updated immediately upon orientationchange
    // or resize (sometimes the events fire before the data is synched) we update at
    // the moment of the event and guarantee at least one update later than 100
    // milliseconds (debouncing if numerous changes come in within the timeout window)
    //
    let doublingTimer = null
    const doubledListenerFunction = () => {
        listenerFunction()
        if (doublingTimer) {
            clearTimeout(doublingTimer)
        }
        doublingTimer = setTimeout(100, () => {
            listenerFunction()
            doublingTimer = null
        })
    }
    window.addEventListener('resize', doubledListenerFunction)
    window.addEventListener('orientationchange', doubledListenerFunction)

//
// Now that we have a set and responsive "vh" viewport height measure, we render
// the app.
//

ReactDOM.render(
    <App />,
    document.getElementById('root')
)

// If you want your app to work offline and load faster, you can change
// unregister() to register() below. Note this comes with some pitfalls.
// Learn more about service workers: https://bit.ly/CRA-PWA
serviceWorker.unregister();
