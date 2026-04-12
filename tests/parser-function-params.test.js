const { Parser, UnsafeParser, UnsafeLexer } = require('../dist');

describe('greyscript function parameters', function () {
  test('expression default values are allowed', () => {
    const content = 'f = function(x = foo + bar)\nend function';
    const parser = new Parser(content, { tabWidth: 2 });
    const chunk = parser.parseChunk();
    // Should not throw — greyscript-core allows non-literal defaults
    expect(chunk.toString()).toMatchSnapshot();
  });

  test('call expression as default value', () => {
    const content = 'f = function(x = getDefault())\nend function';
    const parser = new Parser(content, { tabWidth: 2 });
    const chunk = parser.parseChunk();
    expect(chunk.toString()).toMatchSnapshot();
  });

  test('member expression as default value', () => {
    const content = 'f = function(x = obj.prop)\nend function';
    const parser = new Parser(content, { tabWidth: 2 });
    const chunk = parser.parseChunk();
    expect(chunk.toString()).toMatchSnapshot();
  });

  test('literal default values still work', () => {
    const content = 'f = function(x = 42, y = "hello")\nend function';
    const parser = new Parser(content, { tabWidth: 2 });
    const chunk = parser.parseChunk();
    expect(chunk.toString()).toMatchSnapshot();
  });

  test('multiple params with mixed defaults', () => {
    const content = 'f = function(a, b = 1, c = foo())\nend function';
    const parser = new Parser(content, { tabWidth: 2 });
    const chunk = parser.parseChunk();
    expect(chunk.toString()).toMatchSnapshot();
  });
});
