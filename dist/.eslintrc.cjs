module.exports = {
  extends: ['react-app', 'react-app/jest', 'prettier'],
  rules: {
    'react/jsx-no-useless-fragment': 'error',
    'react/self-closing-comp': [
      'error',
      {
        component: true,
        html: true,
      },
    ],
  },
  overrides: [
    {
      files: ['**/*.ts?(x)'],
      rules: {
        '@typescript-eslint/no-unused-vars': 'error',
      },
    },
  ],
};
