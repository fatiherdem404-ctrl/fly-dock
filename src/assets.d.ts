/// <reference types="vite/client" />
// Pictures imported by the renderer come out as their URL.
declare module '*.png' {
  const src: string
  export default src
}
