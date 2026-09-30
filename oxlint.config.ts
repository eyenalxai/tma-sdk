import type { OxlintConfig } from "oxlint"

import { defineConfig } from "oxlint"
import { REACT_DOCTOR_RULES } from "oxlint-plugin-react-doctor"

type PluginConfig = NonNullable<OxlintConfig["plugins"]>
type RuleConfig = NonNullable<OxlintConfig["rules"]>
type SettingsConfig = NonNullable<OxlintConfig["settings"]>
type JsPluginsConfig = NonNullable<OxlintConfig["jsPlugins"]>

type ReactDoctorRuleEntry = {
  key: string
  rule: { framework?: string }
}

const plugins: PluginConfig = [
  "typescript",
  "unicorn",
  "oxc",
  "promise",
  "import",
  "node",
  "react",
  "react-perf",
]

const jsPlugins: JsPluginsConfig = [
  { name: "react-doctor", specifier: "oxlint-plugin-react-doctor" },
]

// Mirrors the React Doctor group policy of @fcy/oxlint-config, but derives the
// rule list from the installed plugin so newly added rules are enabled
// automatically instead of waiting for a generated registry to catch up.
const reactDoctorDisabledFrameworks = new Set(["nextjs", "preact"])

// Intentionally accepted patterns; see the per-rule rationale in
// fcy-app/packages/oxlint-config/src/react-doctor/groups.ts.
const reactDoctorAcceptedRules = new Set([
  "react-doctor/control-has-associated-label",
  "react-doctor/design-no-em-dash-in-jsx-text",
  "react-doctor/hook-use-state",
  "react-doctor/jsx-props-no-spreading",
  "react-doctor/no-event-handler",
  "react-doctor/no-generic-handler-names",
  "react-doctor/no-many-boolean-props",
  "react-doctor/no-prevent-default",
  "react-doctor/no-static-element-interactions",
  "react-doctor/react-in-jsx-scope",
  "react-doctor/rendering-svg-precision",
])

const buildReactDoctorRules = (): RuleConfig => {
  const entries: readonly ReactDoctorRuleEntry[] = REACT_DOCTOR_RULES
  const rules: RuleConfig = {}

  for (const { key, rule } of entries) {
    const disabled =
      reactDoctorDisabledFrameworks.has(rule.framework ?? "") || reactDoctorAcceptedRules.has(key)
    rules[key] = disabled ? "off" : "error"
  }

  return rules
}

const categories: NonNullable<OxlintConfig["categories"]> = {
  correctness: "error",
  suspicious: "error",
  perf: "error",
  pedantic: "error",
  style: "error",
  restriction: "error",
}

const rules: RuleConfig = {
  ...buildReactDoctorRules(),
  "unicorn/max-nested-calls": "off", // I don't like it
  "unicorn/prefer-export-from": "off", // I don't like it
  "node/callback-return": "off", // Results in false positives
  "typescript/prefer-readonly-parameter-types": "off",
  "typescript/explicit-function-return-type": "off",
  "typescript/explicit-module-boundary-types": "off",
  "typescript/consistent-type-definitions": ["error", "type"],
  "unicorn/prefer-global-this": "off",
  "func-style": ["error", "expression"],
  "no-magic-numbers": "off",
  "oxc/no-optional-chaining": "off",
  "oxc/no-rest-spread-properties": "off",
  "oxc/no-async-await": "off",
  "unicorn/no-null": "off",
  "sort-imports": "off",
  "no-undefined": "off",
  "max-statements": "off",
  "unicorn/no-process-exit": "off",
  "no-ternary": "off",
  "no-continue": "off",
  "prefer-destructuring": "off",
  "no-console": "off",
  "no-warning-comments": "off",
  "max-params": "off",
  "max-lines-per-function": "off",
  "id-length": "off",
  "no-inline-comments": "off",
  "unicorn/no-array-reduce": "error",
  "no-use-before-define": "error",
  "no-useless-return": "error",
  "no-duplicate-imports": "off", // Does not work with oxfmt, yikes
  "no-void": "off",
  "typescript/explicit-member-accessibility": "off",
  complexity: "error",
  "max-classes-per-file": "off",
  "new-cap": "error",
  "require-await": "off", // This rule is inferior to the accuracy of the type-aware typescript/require-await rule.
  "no-plusplus": "error",
  "init-declarations": "error",
  "sort-keys": "off", // Breaks TanStack Query mutation context inference by reordering callbacks.
  "oxc/erasing-op": "error",
  "no-nested-ternary": "off",
  "unicorn/no-nested-ternary": "off",
  "typescript/use-unknown-in-catch-callback-variable": "error",
  "typescript/no-non-null-assertion": "error",
  "typescript/no-confusing-void-expression": "error",
  "oxc/no-map-spread": "off", // Keeping spread: Object.assign alternative causes accidental mutability
  "unicorn/no-await-expression-member": "error",
  "no-empty-function": "error",
  "unicorn/no-useless-collection-argument": "error",
  "unicorn/prefer-ternary": "error",
  "one-var": ["error", "never"], // Keeps oxfmt's one declaration per statement style; "always" would force unreadable comma chains.
  "no-negated-condition": "error",
  "typescript/array-type": "error",
  "typescript/unified-signatures": "error",
  "arrow-body-style": ["error", "as-needed", { requireReturnForObjectLiteral: true }],
  "import/prefer-default-export": "off",
  "import/no-namespace": "off", // Breaks Zod's recommended `import * as z from "zod"` style.
  "import/no-named-export": "off",
  "import/no-named-default": "error",
  "promise/prefer-await-to-then": "error",
  "import/group-exports": "error",
  "promise/prefer-await-to-callbacks": "off", // We like neverthrow match statements.
  "node/no-process-env": "error",
  "import/exports-last": "error",
  "import/max-dependencies": "off", // A lot of dependencies is fine if complexity is fine.
  "import/consistent-type-specifier-style": ["error", "prefer-top-level"],
  "typescript/no-import-type-side-effects": "error",
  "import/no-relative-parent-imports": "error",
  "import/unambiguous": "error",
  "oxc/no-barrel-file": "error",
  "import/first": "error",
  "promise/avoid-new": "off", // Callback-only APIs need promise adapters; this rule encourages behavior-changing rewrites.
  "import/no-nodejs-modules": "off", // Accidental client Node imports are easy to spot.
  "import/no-default-export": "error",
  "typescript/parameter-properties": "error",
  "unicorn/custom-error-definition": "error",
  "react/jsx-no-literals": "off",
  "react/react-in-jsx-scope": "off",
  "react/jsx-filename-extension": "off",
  "react-perf/jsx-no-new-function-as-prop": "off",
  "react/jsx-max-depth": "off",
  "react-perf/jsx-no-new-array-as-prop": "off",
  "react-perf/jsx-no-new-object-as-prop": "error",
  "react/no-children-prop": "error",
  "react-perf/jsx-no-jsx-as-prop": "off",
  "react/jsx-handler-names": "off",
  "react/only-export-components": "off",
  "react/jsx-props-no-spreading": "off",
  "react/no-multi-comp": "off",
  "react/hook-use-state": "off",
  "react/forbid-component-props": "off",
  "react/function-component-definition": [
    "error",
    {
      namedComponents: "arrow-function",
      unnamedComponents: "arrow-function",
    },
  ],
}

const settings: SettingsConfig = {
  react: {
    version: "19.3.0",
  },
  "react-doctor": {
    forbidComponentProps: {
      forbid: ["style"],
    },
    onlyExportComponents: {
      allowExportNames: ["metadata", "generateMetadata", "viewport", "generateViewport"],
    },
  },
}

const ignorePatterns = [
  "**/node_modules/**",
  "**/dist/**",
  "**/*.d.ts",
  "**/*.config.{js,ts,mjs,cjs}",
  "**/tsconfig.tsbuildinfo",
  ".changeset/**",
]

const config: OxlintConfig = {
  plugins,
  jsPlugins,
  categories,
  rules,
  settings,
  env: {
    builtin: true,
  },
  ignorePatterns,
}

export default defineConfig(config)
