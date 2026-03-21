import { dual } from "effect/Function"

export namespace Optional {
  export const map = dual<
    <I, O>(f: (value: I) => O) => (opt: I | undefined) => O | undefined,
    <I, O>(opt: I | undefined, f: (value: I) => O) => O | undefined
  >(2, (opt, f) => {
    if (opt === undefined) return undefined
    return f(opt)
  })
}
