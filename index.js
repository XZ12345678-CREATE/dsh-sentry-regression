// Standalone DSH plugin; package-local imports only.
import { definePlugin } from './lib/provider.js';
const plugin = definePlugin({ name: 'dsh-sentry-regression', skills: ["dsh-sentry-regression"], baseURL: new URL('.', import.meta.url) });
export const { name, inject, skillNames, createProvider } = plugin;
export function apply(ctx, config = {}) { plugin.apply(ctx, config);  }
