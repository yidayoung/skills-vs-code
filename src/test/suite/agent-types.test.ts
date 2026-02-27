import * as assert from 'assert';
import type { SupportedAgent } from '../../types/agents';

suite('Agent Types Tests', () => {
  test('SupportedAgent should include codex', () => {
    const agent: SupportedAgent = 'codex';
    assert.strictEqual(agent, 'codex');
  });
});
