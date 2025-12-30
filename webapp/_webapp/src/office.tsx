const Greeting = () => {
    return <h1>Hello, World!</h1>
}

import r2wc from "@r2wc/react-to-web-component"

const WebGreeting = r2wc(Greeting)

customElements.define("web-greeting", WebGreeting)
