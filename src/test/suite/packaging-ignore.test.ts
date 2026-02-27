import * as assert from 'assert';
import * as fs from 'fs';
import * as path from 'path';

suite('Packaging Ignore Rules', () => {
  test('must not exclude root node_modules from VSIX', () => {
    const vscodeIgnorePath = path.resolve(__dirname, '../../../.vscodeignore');
    const content = fs.readFileSync(vscodeIgnorePath, 'utf8');
    const lines = content
      .split(/\r?\n/)
      .map(line => line.trim())
      .filter(line => line.length > 0 && !line.startsWith('#'));

    assert.ok(
      !lines.includes('node_modules/**'),
      '`.vscodeignore` excludes `node_modules/**`, which removes runtime dependencies from VSIX and breaks extension activation.'
    );
  });
});
