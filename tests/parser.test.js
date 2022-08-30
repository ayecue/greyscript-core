const { Parser, Lexer, ASTBase } = require('../dist');
const fs = require('fs');
const path = require('path');
const testFolder = path.resolve(__dirname, 'scripts');
const util = require('util');

describe('parse', function() {
	describe.only('default scripts', function() {
		fs
			.readdirSync(testFolder)
			.forEach(file => {
				const filepath = path.resolve(testFolder, file);

				test(path.basename(filepath), () => {
					const content = fs.readFileSync(filepath, 'utf-8');
					const parser = new Parser(content, {
						tabWidth: 4
					});
					const payload = util.inspect(parser.parseChunk(), {
						depth: 4
					});

					expect(payload).toMatchSnapshot();
				});
			});

		fs
			.readdirSync(testFolder)
			.forEach(file => {
				const filepath = path.resolve(testFolder, file);

				test(path.basename(filepath) + ' unsafe', () => {
					const content = fs.readFileSync(filepath, 'utf-8');
					const parser = new Parser(content, {
						tabWidth: 4,
						unsafe: true
					});
					const payload = util.inspect(parser.parseChunk(), {
						depth: 4
					});

					expect(payload).toMatchSnapshot();
				});
			});
		
		test('invalid code', () => {
			const content = `
				print(" ad"

				print())

				print("was")

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
			const lexer = new Lexer(content, { unsafe: true });
			const parser = new Parser(content, {
				unsafe: true,
				lexer
			});

			parser.parseChunk();

			expect(lexer.errors).toMatchSnapshot();
			expect(parser.errors).toMatchSnapshot();
		});
	});
});