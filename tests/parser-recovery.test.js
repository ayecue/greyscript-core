const { UnsafeParser, UnsafeLexer } = require('../dist');

describe('state recovery', function () {
  test('nativeImports are restored after a failed statement', () => {
    const content = `
import_code("lib1.src")
bad line @@@
import_code("lib2.src")
print("done")
    `;
    const lexer = new UnsafeLexer(content, { tabWidth: 2 });
    const parser = new UnsafeParser(content, { lexer });
    parser.parseChunk();

    expect(parser.errors.length).toBeGreaterThan(0);

    expect(parser.state.nativeImports.length).toBe(2);
    expect(parser.state.nativeImports[0].directory).toBe('lib1.src');
    expect(parser.state.nativeImports[1].directory).toBe('lib2.src');
  });

  test('multiple errors do not leak nativeImports', () => {
    const content = `
import_code("first.src")
foo(bar @@@
import_code("second.src")
baz(qux @@@
import_code("third.src")
    `;
    const lexer = new UnsafeLexer(content, { tabWidth: 2 });
    const parser = new UnsafeParser(content, { lexer });
    parser.parseChunk();

    expect(parser.errors.length).toBeGreaterThan(0);
    expect(parser.state.nativeImports.length).toBe(3);
    expect(parser.state.nativeImports[0].directory).toBe('first.src');
    expect(parser.state.nativeImports[1].directory).toBe('second.src');
    expect(parser.state.nativeImports[2].directory).toBe('third.src');
  });

  test('includes and nativeImports both recovered', () => {
    const content = `
#include "mylib.src"
import_code("native.src")
bad @@@
#include "mylib2.src"
import_code("native2.src")
    `;
    const lexer = new UnsafeLexer(content, { tabWidth: 2 });
    const parser = new UnsafeParser(content, { lexer });
    parser.parseChunk();

    expect(parser.errors.length).toBeGreaterThan(0);
    expect(parser.state.includes.length).toBe(2);
    expect(parser.state.includes[0].path).toBe('mylib.src');
    expect(parser.state.includes[1].path).toBe('mylib2.src');
    expect(parser.state.nativeImports.length).toBe(2);
    expect(parser.state.nativeImports[0].directory).toBe('native.src');
    expect(parser.state.nativeImports[1].directory).toBe('native2.src');
  });

  test('error inside function does not corrupt nativeImports', () => {
    const content = `
import_code("before.src")
myFunc = function()
  print("inside")
  bad @@@
  print("after bad")
end function
import_code("after.src")
    `;
    const lexer = new UnsafeLexer(content, { tabWidth: 2 });
    const parser = new UnsafeParser(content, { lexer });
    parser.parseChunk();

    expect(parser.errors.length).toBeGreaterThan(0);
    expect(parser.state.nativeImports.length).toBe(2);
    expect(parser.state.nativeImports[0].directory).toBe('before.src');
    expect(parser.state.nativeImports[1].directory).toBe('after.src');
  });

  test('state recovery inside #if env block with nativeImports', () => {
    const content = `
import_code("always.src")
#if DEBUG
import_code("debug.src")
bad line @@@
import_code("debug2.src")
#else
import_code("release.src")
#endif
    `;
    const lexer = new UnsafeLexer(content, { tabWidth: 2 });
    const parser = new UnsafeParser(content, {
      lexer,
      environmentVariables: new Map([['DEBUG', '1']])
    });
    parser.parseChunk();

    expect(parser.errors.length).toBeGreaterThan(0);

    expect(parser.state.nativeImports.length).toBe(3);
    expect(parser.state.nativeImports[0].directory).toBe('always.src');
    expect(parser.state.nativeImports[1].directory).toBe('debug.src');
    expect(parser.state.nativeImports[2].directory).toBe('debug2.src');
  });

  test('state recovery inside #else env block with nativeImports', () => {
    const content = `
import_code("always.src")
#if DEBUG
import_code("debug.src")
#else
import_code("release.src")
bad line @@@
import_code("release2.src")
#endif
    `;
    const lexer = new UnsafeLexer(content, { tabWidth: 2 });
    const parser = new UnsafeParser(content, {
      lexer,
      environmentVariables: new Map()
    });
    parser.parseChunk();

    expect(parser.errors.length).toBeGreaterThan(0);

    expect(parser.state.nativeImports.length).toBe(3);
    expect(parser.state.nativeImports[0].directory).toBe('always.src');
    expect(parser.state.nativeImports[1].directory).toBe('release.src');
    expect(parser.state.nativeImports[2].directory).toBe('release2.src');
  });
});
