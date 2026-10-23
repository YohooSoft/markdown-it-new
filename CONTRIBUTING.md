# Contributing to markdown-it-new

`markdown-it-new` is a fork of `markdown-it`. Preserve upstream Markdown and
CommonMark behavior unless the change intentionally extends it and documents
the new output.

## Report a bug

Search the [existing issues](https://github.com/YohooSoft/markdown-it-new/issues)
before opening a new issue.

Include this information:

- the package version;
- the Node.js version or browser;
- the selected preset and Markdown-it options;
- the smallest Markdown source that reproduces the problem;
- the actual HTML and the expected HTML;
- a runnable repository or code sample when the problem depends on a framework.

For CommonMark behavior, compare the result with both the
[markdown-it demo](https://markdown-it.github.io/) in `CommonMark strict` mode
and the [CommonMark dingus](https://spec.commonmark.org/dingus/).

For a new syntax feature, describe the source syntax, the rendered HTML, the
disabled behavior, and the security boundary.

## Set up the repository

```sh
git clone https://github.com/YohooSoft/markdown-it-new.git
cd markdown-it-new
npm clean-install
```

Create a focused branch for the change. Do not edit generated files in
`dist/`; `npm run build` recreates them from `src/`.

## Check a change

Run these checks before opening a pull request:

```sh
npm run lint
npx tsc --noEmit
npm run build
NODE_OPTIONS=--experimental-strip-types npm run test:cmspec
NODE_OPTIONS=--experimental-strip-types npm run test:markdown-it
npm run test:build
git diff --check
```

In PowerShell, set the Node option once before the test commands:

```powershell
$env:NODE_OPTIONS = '--experimental-strip-types'
```

## Keep extensions safe

The default preset enables several bounded extensions while arbitrary HTML
stays disabled. Keep those boundaries intact:

- iframe and HTML image sources accept absolute HTTPS URLs;
- unsafe URLs and attributes render as escaped source text;
- task, table, and code controls use generated attributes and event delegation;
- LaTeX output remains compatible with MathJax;
- GLB and GLTF output uses the `<model-viewer>` Web Component.

Validate external input where the parser receives it. Do not add event-handler
attributes, script URLs, `srcdoc`, or raw user HTML to generated output.

## Open a pull request

Open a pull request against
[`YohooSoft/markdown-it-new`](https://github.com/YohooSoft/markdown-it-new/pulls).
Keep one behavior change per pull request.

The pull request description must include:

- the problem and the chosen behavior;
- representative Markdown input and rendered HTML;
- the commands used to verify the change;
- browser screenshots for visible controls;
- compatibility or security effects.

Update `README.md`, `src/types.ts`, and the relevant presets when a change
adds or changes an option. Add focused coverage for parser or renderer behavior.

## Use AI tools responsibly

AI tools may assist with a contribution. The submitter remains the author.
Read the changed code, verify the result, and explain the decisions in review.
Do not submit generated code that you cannot maintain.

## License

Contributions use the repository's MIT license. Preserve the upstream
attribution and the `Mryan2005` copyright notice in `LICENSE`.
