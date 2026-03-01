const { Parser, UnsafeParser, UnsafeLexer, ASTImportCodeExpression } = require('../dist');
const { ASTType } = require('miniscript-core');
const { describeErrors } = require('./test-utils');

describe('import_code', function () {
  describe('basic parsing', function () {
    test('simple import_code with string argument', () => {
      const parser = new Parser('import_code("myfile")', { tabWidth: 2 });
      const chunk = parser.parseChunk();

      expect(chunk.nativeImports.length).toBe(1);
      const imp = chunk.nativeImports[0];
      expect(imp.type).toBe('ImportCodeExpression');
      expect(imp.directory).toBe('myfile');
      expect(imp.originalDirectory).toBe('myfile');
      expect(imp.eval).toBe(true);
      expect(imp.emit).toBe(true);
    });

    test('import_code is registered in state.nativeImports', () => {
      const parser = new Parser('import_code("myfile")', { tabWidth: 2 });
      parser.parseChunk();

      expect(parser.state.nativeImports.length).toBe(1);
    });

    test('multiple import_code statements', () => {
      const content = 'import_code("a")\nimport_code("b")\nimport_code("c")';
      const parser = new Parser(content, { tabWidth: 2 });
      const chunk = parser.parseChunk();

      expect(chunk.nativeImports.length).toBe(3);
      expect(chunk.nativeImports[0].directory).toBe('a');
      expect(chunk.nativeImports[1].directory).toBe('b');
      expect(chunk.nativeImports[2].directory).toBe('c');
    });

    test('import_code toString format', () => {
      const parser = new Parser('import_code("myfile")', { tabWidth: 2 });
      const chunk = parser.parseChunk();

      const str = chunk.nativeImports[0].toString();
      expect(str).toMatch(/^ImportCode\[/);
      expect(str).toContain('myfile');
      expect(str).toContain('true');
    });
  });

  describe('error paths', function () {
    test('no opening parenthesis raises error', () => {
      expect(() => {
        new Parser('import_code', { tabWidth: 2 }).parseChunk();
      }).toThrow(/expected import_code to have opening parenthesis/);
    });

    test('non-string argument raises error', () => {
      expect(() => {
        new Parser('import_code(123)', { tabWidth: 2 }).parseChunk();
      }).toThrow(/expected import_code argument to be string literal/);
    });

    test('no closing parenthesis raises error', () => {
      expect(() => {
        new Parser('import_code("file"', { tabWidth: 2 }).parseChunk();
      }).toThrow(/expected import_code to have closing parenthesis/);
    });

    test('unsafe mode recovers from missing parenthesis', () => {
      const content = 'import_code\nx = 1';
      const lexer = new UnsafeLexer(content, { tabWidth: 2 });
      const parser = new UnsafeParser(content, { lexer, tabWidth: 2 });
      parser.parseChunk();

      expect(parser.errors.length).toBeGreaterThan(0);
      expect(parser.errors[0].message).toMatch(/opening parenthesis/);
    });

    test('unsafe mode recovers from non-string argument', () => {
      const content = 'import_code(123)\nx = 1';
      const lexer = new UnsafeLexer(content, { tabWidth: 2 });
      const parser = new UnsafeParser(content, { lexer, tabWidth: 2 });
      parser.parseChunk();

      expect(parser.errors.length).toBeGreaterThan(0);
      expect(parser.errors[0].message).toMatch(/string literal/);
    });
  });

  describe('deprecated 2-arg form', function () {
    test('two-arg form with colon separator emits warning', () => {
      const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
      try {
        const parser = new Parser('import_code("file" : "dir")', { tabWidth: 2 });
        const chunk = parser.parseChunk();

        expect(warnSpy).toHaveBeenCalledWith(
          expect.stringContaining('deprecated')
        );
        expect(chunk.nativeImports[0].directory).toBe('dir');
      } finally {
        warnSpy.mockRestore();
      }
    });

    test('two-arg form with non-string second arg raises error', () => {
      expect(() => {
        new Parser('import_code("file" : 123)', { tabWidth: 2 }).parseChunk();
      }).toThrow(/string literal/);
    });
  });

  describe('meta comment parsing', function () {
    test('no-eval meta disables eval', () => {
      const parser = new Parser('import_code("myfile") //no-eval', { tabWidth: 2 });
      const chunk = parser.parseChunk();

      expect(chunk.nativeImports[0].eval).toBe(false);
      expect(chunk.nativeImports[0].emit).toBe(true);
    });

    test('no-emit meta disables emit', () => {
      const parser = new Parser('import_code("myfile") //no-emit', { tabWidth: 2 });
      const chunk = parser.parseChunk();

      expect(chunk.nativeImports[0].eval).toBe(true);
      expect(chunk.nativeImports[0].emit).toBe(false);
    });

    test('override meta changes directory', () => {
      const parser = new Parser('import_code("original") //override=/custom/path', { tabWidth: 2 });
      const chunk = parser.parseChunk();

      expect(chunk.nativeImports[0].directory).toBe('/custom/path');
      expect(chunk.nativeImports[0].originalDirectory).toBe('original');
    });

    test('combined meta options', () => {
      const parser = new Parser('import_code("myfile") //no-eval;no-emit;override=/other', { tabWidth: 2 });
      const chunk = parser.parseChunk();

      const imp = chunk.nativeImports[0];
      expect(imp.eval).toBe(false);
      expect(imp.emit).toBe(false);
      expect(imp.directory).toBe('/other');
      expect(imp.originalDirectory).toBe('myfile');
    });

    test('no meta comment leaves defaults', () => {
      const parser = new Parser('import_code("myfile")', { tabWidth: 2 });
      const chunk = parser.parseChunk();

      expect(chunk.nativeImports[0].eval).toBe(true);
      expect(chunk.nativeImports[0].emit).toBe(true);
    });
  });

  describe('parseMetaOptions static method', function () {
    test('no-eval option', () => {
      const result = ASTImportCodeExpression.parseMetaOptions('no-eval');
      expect(result.eval).toBe(false);
      expect(result.emit).toBe(true);
    });

    test('no-emit option', () => {
      const result = ASTImportCodeExpression.parseMetaOptions('no-emit');
      expect(result.emit).toBe(false);
      expect(result.eval).toBe(true);
    });

    test('override option', () => {
      const result = ASTImportCodeExpression.parseMetaOptions('override=/my/path');
      expect(result.directory).toBe('/my/path');
      expect(result.eval).toBe(true);
      expect(result.emit).toBe(true);
    });

    test('combined options', () => {
      const result = ASTImportCodeExpression.parseMetaOptions('no-eval;no-emit;override=/custom');
      expect(result).toEqual({
        eval: false,
        emit: false,
        directory: '/custom'
      });
    });

    test('empty string returns defaults', () => {
      const result = ASTImportCodeExpression.parseMetaOptions('');
      expect(result.eval).toBe(true);
      expect(result.emit).toBe(true);
      expect(result.directory).toBeUndefined();
    });

    test('unknown option leaves defaults unchanged', () => {
      const result = ASTImportCodeExpression.parseMetaOptions('unknown-option');
      expect(result.eval).toBe(true);
      expect(result.emit).toBe(true);
    });
  });
});
