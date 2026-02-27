import * as assert from 'assert';
import Module = require('module');

const ModuleAny = Module as any;
const originalModuleLoad = ModuleAny._load;
ModuleAny._load = function (request: string, parent: NodeModule | null, isMain: boolean) {
  if (request === 'vscode') {
    return {};
  }
  return originalModuleLoad.call(this, request, parent, isMain);
};

const { APIClient } = require('../../managers/APIClient') as { APIClient: new (configs: any[]) => any };

suite('APIClient Multi-skill Result Handling', () => {
  test('should keep different sub-skills from same repository as separate results', () => {
    const client = new APIClient([]);

    const normalizeSkillResult = (client as any).normalizeSkillResult.bind(client);
    const deduplicateSkills = (client as any).deduplicateSkills.bind(client);

    const resultA = normalizeSkillResult(
      {
        name: 'Config Basic',
        source: 'acme/skills-repo',
        skillId: 'config-basic'
      },
      'http://localhost:3000',
      'Local Market'
    );

    const resultB = normalizeSkillResult(
      {
        name: 'Config Advanced',
        source: 'acme/skills-repo',
        skillId: 'config-advanced'
      },
      'http://localhost:3000',
      'Local Market'
    );

    assert.strictEqual(resultA.id, 'acme/skills-repo#config-basic');
    assert.strictEqual(resultB.id, 'acme/skills-repo#config-advanced');

    const deduped = deduplicateSkills([resultA, resultB]);
    assert.strictEqual(
      deduped.length,
      2,
      'Deduplication should not merge different sub-skills from the same repository'
    );
  });
});
