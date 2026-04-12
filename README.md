# greyscript-core

[![greyscript-core](https://circleci.com/gh/ayecue/greyscript-core.svg?style=svg)](https://circleci.com/gh/ayecue/greyscript-core)

A lexer and parser that extends [greybel-core](../greybel-core) with [Grey Hack](https://store.steampowered.com/app/605230/Grey_Hack/)-specific language features. GreyScript is the scripting language used inside Grey Hack and is a superset of both [MiniScript](https://miniscript.org) and Greybel.

## Features on top of greybel-core

### `import_code`

Grey Hack's native mechanism for importing compiled scripts at runtime:

```
import_code("mylib.src")
```

The parser produces an `ASTImportCodeExpression` node with the following properties:

| Property | Description |
|---|---|
| `directory` | The resolved import path |
| `originalDirectory` | The path as written in source |
| `eval` | Whether the import should be evaluated (default `true`) |
| `emit` | Whether the import should be emitted (default `true`) |

Meta options can be attached via semicolon-delimited tags in the path string (e.g. `no-eval`, `no-emit`, `override=<path>`).

### Full feature stack

greyscript-core inherits all features from the packages it extends:

| Layer | Key additions |
|---|---|
| [miniscript-core](../miniscript-core) | Base MiniScript lexer, parser, AST, error recovery |
| [greybel-core](../greybel-core) | `#include`, `#import`, `#inject`, `#envar`, `#line`, `#filename`, `debugger`, `#if`/`#else`/`#endif`, bitwise operators (`&`, `\|`, `<<`, `>>`, `>>>`) |
| **greyscript-core** | `import_code` |

## Install

```
npm install greyscript-core
```

## Usage

```ts
import { Parser } from 'greyscript-core';

const code = `
import_code("networking.src")
#include "utils.src"
print("hello")
`;

const parser = new Parser(code, {
  filename: 'main.src'
});
const chunk = parser.parseChunk();

console.log(chunk.nativeImports); // [ASTImportCodeExpression]
console.log(chunk.includes);      // [ASTFeatureIncludeExpression]
console.log(chunk.toString());
```

### Unsafe mode

```ts
import { UnsafeParser, UnsafeLexer } from 'greyscript-core';

const code = 'import_code("lib.src"\nprint("hello")';
const lexer = new UnsafeLexer(code);
const parser = new UnsafeParser(code, { lexer });

parser.parseChunk();

console.log(parser.errors); // recoverable errors
console.log(lexer.errors);  // lexer-level errors
```

## Extending

greyscript-core follows the same extension patterns as miniscript-core and greybel-core. The keyword handler builder is available via `greyscriptKeywordHandlerBuilder()` and can be extended with additional entries.

`GreyscriptParserState` extends `GreybelParserState` with a `nativeImports` array. Subclasses that add their own state fields should override `snapshot()`, `restore()`, `merge()`, `createEmpty()`, and `clone()`.

## Testing

```
npm test
```