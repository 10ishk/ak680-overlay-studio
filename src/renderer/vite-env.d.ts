/// <reference types="vite/client" />

declare namespace JSX {
  interface IntrinsicElements {
    webview: React.DetailedHTMLProps<React.HTMLAttributes<HTMLElement>, HTMLElement> & {
      src?: string;
      allow?: string;
      partition?: string;
      preload?: string;
      onIpcMessage?: (event: unknown) => void;
      onDidNavigate?: (event: React.SyntheticEvent<HTMLElement>) => void;
      onDidNavigateInPage?: (event: React.SyntheticEvent<HTMLElement>) => void;
      onPageTitleUpdated?: (event: React.SyntheticEvent<HTMLElement>) => void;
    };
  }
}
