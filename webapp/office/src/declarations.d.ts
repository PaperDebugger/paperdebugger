import * as React from 'react';

declare global {
    namespace JSX {
        interface IntrinsicElements {
            "paperdebugger-office": React.DetailedHTMLProps<
                React.HTMLAttributes<HTMLElement> & {
                    "display-mode"?: string;
                    "adapter-id"?: string;
                },
                HTMLElement
            >;
        }
    }
}
