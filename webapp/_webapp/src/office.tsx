import r2wc from "@r2wc/react-to-web-component";

const Greeting = () => {
  return <h1>Hello, World!</h1>;
};

const PaperdebuggerOffice = r2wc(Greeting);
customElements.define("paperdebugger-office", PaperdebuggerOffice);
