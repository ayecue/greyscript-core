const { Parser, Lexer, ASTBase, UnsafeParser, UnsafeLexer } = require('../dist');
const { ASTType } = require('miniscript-core');
const fs = require('fs');
const path = require('path');
const testFolder = path.resolve(__dirname, 'scripts');

function describeErrors(errors) {
  return errors.map((e) => ({
    message: e.message,
    range: e.range ? { start: e.range.start, end: e.range.end } : null,
    code: e.code,
    hint: e.hint ?? null
  }));
}

describe('parse', function () {
  describe('default scripts', function () {
    fs
      .readdirSync(testFolder)
      .forEach(file => {
        const filepath = path.resolve(testFolder, file);

        test(path.basename(filepath), () => {
          const content = fs.readFileSync(filepath, 'utf-8');
          const parser = new Parser(content, {
            tabWidth: 2
          });
          const payload = parser.parseChunk();

          expect(payload.toString()).toMatchSnapshot();
          expect(payload.namespaces.reduce((result, item) => {
            let currentIdentifier = item;
            if (item.type === ASTType.MemberExpression) {
              currentIdentifier = item.identifier;
            }
            if (!result[currentIdentifier.kind]) result[currentIdentifier.kind] = 0;
            result[currentIdentifier.kind]++;
            return result;
          }, {})).toMatchSnapshot();
          expect(payload.literals.length).toMatchSnapshot();
          expect(payload.nativeImports.length).toMatchSnapshot();
          expect(payload.definitions.length).toMatchSnapshot();
        });
      });

    fs
      .readdirSync(testFolder)
      .forEach(file => {
        const filepath = path.resolve(testFolder, file);

        test(path.basename(filepath) + ' unsafe', () => {
          const content = fs.readFileSync(filepath, 'utf-8');
          const parser = new UnsafeParser(content, {
            tabWidth: 2
          });
          const payload = parser.parseChunk().toString();

          expect(payload).toMatchSnapshot();
        });
      });

    test('invalid code', () => {
      const content = `
				print(" ad"

				print())

				print("was")

				wad;  aw dwad wa

				not @a;not -@b
				not +@v

				not not not not not not not not @a

				if not @a then x

				function () .
				end func

				print("wo")

				if (true) then;
					print("true")
				else;
					print((false));
				end if;

				if (false) print("false")
			`;
      const lexer = new UnsafeLexer(content, { tabWidth: 2 });
      const parser = new UnsafeParser(content, {
        lexer
      });

      parser.parseChunk();

      expect(describeErrors(lexer.errors)).toMatchSnapshot();
      expect(describeErrors(parser.errors)).toMatchSnapshot();
    });

    test('open block', () => {
      const content = `
        myComputer = get_shell("root", "test").host_computer

        rootPath = "/root"
        rootFolder = myComputer.File(rootPath)

        folderCount = 0

        while true
          folderName = "testf" + folderCount
          preExisting = myComputer.File(rootFolder.path + "/" + folderName)
          if (preExisting) then preExisting.delete
          result = myComputer.create_folder(rootFolder.path, folderName)
          if result isa string then
            print "Ended with because of " + result
            break
          end if
          print "Created folder " + folderName
          isFull = false
          for index in range(250)
            result = myComputer.touch(rootFolder.path + "/" + folderName, "ppp" + index)
            if result isa string then
              isFull = true
              print "Ended with because of " + result
              break
            end if
            print "Created file " + index + " for " + folderName
          end for
          if isFull then break
          folderCount = folderCount + 1
        end while

        queue = [myComputer.File("/")]
        allFiles = []

        while queue.len
          item = queue.pull
          allFiles = allFiles + item.get_files
          queue = queue + item.get_folders
        end whil

        print allFiles.len
      `;
      const lexer = new UnsafeLexer(content, { tabWidth: 2 });
      const parser = new UnsafeParser(content, {
        lexer
      });

      parser.parseChunk();

      expect(describeErrors(lexer.errors)).toMatchSnapshot();
      expect(describeErrors(parser.errors)).toMatchSnapshot();
    });

    test('using repeat keyword', () => {
      const content = `
        repeat = function(foo)
          print(foo)
        end function
			`;
      const lexer = new UnsafeLexer(content, { tabWidth: 2 });
      const parser = new UnsafeParser(content, {
        lexer
      });

      parser.parseChunk();

      expect(describeErrors(lexer.errors)).toMatchSnapshot();
      expect(describeErrors(parser.errors)).toMatchSnapshot();
    });
  });

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

      // Both valid import_code statements should be present
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

      // truthy branch: always.src + debug.src + debug2.src
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

      // falsy branch: always.src + release.src + release2.src
      expect(parser.state.nativeImports.length).toBe(3);
      expect(parser.state.nativeImports[0].directory).toBe('always.src');
      expect(parser.state.nativeImports[1].directory).toBe('release.src');
      expect(parser.state.nativeImports[2].directory).toBe('release2.src');
    });
  });
});