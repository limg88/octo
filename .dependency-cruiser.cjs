/** Dependency rule: domain <- application <- infrastructure <- apps. */
module.exports = {
  forbidden: [
    {
      name: 'domain-is-pure',
      severity: 'error',
      from: { path: '^packages/domain/src' },
      to: { pathNot: '^packages/domain/src', dependencyTypesNot: ['type-only'] },
    },
    {
      name: 'application-depends-on-domain-only',
      severity: 'error',
      from: { path: '^packages/application/src' },
      to: { path: '^(packages/infrastructure|apps)/|^node:', pathNot: '^packages/application/src' },
    },
    {
      name: 'infrastructure-does-not-know-apps',
      severity: 'error',
      from: { path: '^packages/infrastructure/src' },
      to: { path: '^apps/' },
    },
    {
      name: 'renderer-has-no-node-access',
      severity: 'error',
      from: { path: '^apps/desktop/src/renderer' },
      to: { path: '^(packages/infrastructure|apps/desktop/src/main)/|^node:|^electron$' },
    },
    { name: 'no-circular', severity: 'error', from: {}, to: { circular: true } },
  ],
  options: {
    doNotFollow: { path: 'node_modules' },
    tsPreCompilationDeps: true,
    tsConfig: { fileName: 'tsconfig.base.json' },
    enhancedResolveOptions: { extensions: ['.ts', '.tsx', '.js'] },
  },
}
