/**
 * Provider Registry
 * Manages registration and lookup of host providers
 */

import type { HostProvider, ProviderRegistry } from './types';

class ProviderRegistryImpl implements ProviderRegistry {
  private providers = new Map<string, HostProvider>();

  register(provider: HostProvider): void {
    if (this.providers.has(provider.id)) {
      console.warn(`Provider ${provider.id} is already registered. Overwriting.`);
    }
    this.providers.set(provider.id, provider);
  }

  findProvider(url: string): HostProvider | null {
    for (const provider of this.providers.values()) {
      const match = provider.match(url);
      if (match.matches) {
        return provider;
      }
    }
    return null;
  }

  getProviders(): HostProvider[] {
    return Array.from(this.providers.values());
  }
}

/**
 * Global provider registry instance
 */
export const registry = new ProviderRegistryImpl();

/**
 * Register a provider with the global registry.
 */
export function registerProvider(provider: HostProvider): void {
  registry.register(provider);
}

/**
 * Find a provider that matches the given URL.
 */
export function findProvider(url: string): HostProvider | null {
  return registry.findProvider(url);
}

/**
 * Get all registered providers.
 */
export function getProviders(): HostProvider[] {
  return registry.getProviders();
}
