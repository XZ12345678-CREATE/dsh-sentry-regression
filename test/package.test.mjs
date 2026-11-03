import test from 'node:test';
import assert from 'node:assert/strict';
import { access, readFile } from 'node:fs/promises';
import { join, isAbsolute } from 'node:path';
const plugins=[{"name":"dsh-sentry-regression","skills":["dsh-sentry-regression"]}];
for (const info of plugins) {
  const plugin = await import('../index.js');
  test(`${info.name}: independent catalog, body and resources`, async () => {
    const provider = plugin.createProvider();
    const entries = await provider.list();
    assert.deepEqual(entries.map((entry) => entry.name), info.skills);
    for (const entry of entries) {
      assert.equal(entry.provider, info.name);
      assert.equal(entry.content, undefined);
      assert.ok(isAbsolute(entry.resourceBase.path));
      const loaded = await provider.get(entry);
      assert.ok(loaded.content.startsWith('# '));
      await access(join(entry.resourceBase.path, 'SKILL.md'));
    }
    assert.equal(await provider.get({ ...entries[0], locator: '../../LICENSE' }), undefined);
    assert.equal(await provider.get({ ...entries[0], provider: 'other' }), undefined);
    assert.deepEqual(await plugin.createProvider({ enabledSkills: [] }).list(), []);
    assert.throws(() => plugin.createProvider({ enabledSkills: ['outside-family'] }));
    assert.throws(() => plugin.apply({}), /registerProvider/);
    await assert.rejects(provider.list({ signal: AbortSignal.abort() }), { name: 'AbortError' });
  });
}
