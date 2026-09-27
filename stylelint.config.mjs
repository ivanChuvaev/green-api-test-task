import recommendedScss from 'stylelint-config-recommended-scss'

const CAMEL_CASE = /^[a-z][a-zA-Z0-9]*$/

const NESTED_SELECTOR =
  /^(?:&(?:::?[a-z-]+(?:\([^()]*\))?)*(?:\.[a-z][a-zA-Z0-9]*)?(?:\s+[a-z][a-z0-9-]*)?|\.[a-z][a-zA-Z0-9]*)$/

export default {
  extends: [recommendedScss],
  rules: {
    'selector-class-pattern': [
      CAMEL_CASE,
      {
        message: 'Class names must be camelCase (block + element + modifier), e.g. chatHeaderTitle',
        resolveNestedSelectors: true,
      },
    ],
    'selector-nested-pattern': [
      NESTED_SELECTOR,
      {
        message:
          'Nested selectors must be `&`, `&.camelCase` (modifier) or `.camelCase` (element) — no BEM separators',
      },
    ],
    'selector-pseudo-element-colon-notation': 'double',
  },
  overrides: [
    {
      files: ['src/styles/**/*.scss'],
      rules: {
        'selector-class-pattern': null,
      },
    },
  ],
  ignoreFiles: ['dist/**', 'node_modules/**', 'public/**'],
}
