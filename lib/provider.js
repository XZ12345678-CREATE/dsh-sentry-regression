import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

/** Self-contained runtime copied into each package; no monorepo runtime imports. */
export function definePlugin({ name, skills, baseURL }) {
  const skillNames = Object.freeze([...skills]);
  function selection(config = {}) {
    const selected = config.enabledSkills ?? [...skillNames];
    if (!Array.isArray(selected) || selected.some((value) => !skillNames.includes(value))) throw new Error(`Invalid enabledSkills for ${name}.`);
    return [...new Set(selected)];
  }
  async function load(skillName, signal) {
    const base = new URL(`skills/${skillName}/`, baseURL);
    const file = new URL('SKILL.md', base);
    const text = await readFile(file, { encoding: 'utf8', signal });
    const match = /^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/.exec(text);
    const frontmatterName = match && /^name: ([a-z0-9-]+)\r?$/m.exec(match[1])?.[1];
    const description = match && /^description: (.+?)\r?$/m.exec(match[1])?.[1];
    if (frontmatterName !== skillName || !description || !match[2].trim()) throw new Error(`Invalid packaged skill: ${skillName}`);
    return {
      name: skillName, description, content: match[2].trim(), provider: name, source: 'bundled',
      path: fileURLToPath(file), resourceBase: { kind: 'directory', path: fileURLToPath(base) },
      invocation: { modelInvocable: true, userInvocable: true },
    };
  }
  function createProvider(config = {}) {
    const selected = selection(config);
    return {
      name,
      async list(options = {}) {
        return Promise.all(selected.map(async (skillName) => {
          const { content, ...summary } = await load(skillName, options.signal);
          return { ...summary, rank: 600, locator: skillName };
        }));
      },
      async get(candidate, options = {}) {
        if (candidate?.provider !== name || candidate.locator !== candidate.name || !selected.includes(candidate.name)) return undefined;
        return load(candidate.name, options.signal);
      },
    };
  }
  function apply(ctx, config = {}) {
    if (typeof ctx.skills?.registerProvider !== 'function') throw new Error('DSH skills.registerProvider is required.');
    const provider = createProvider(config);
    ctx.skills.registerProvider(() => provider);
  }
  return { name, inject: ['skills'], skillNames, createProvider, apply };
}
