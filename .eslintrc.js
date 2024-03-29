module.exports = {
	env: {
		commonjs: true,
		es2021: true,
		node: true,
	},
	extends: [
		'xo',
	],
	parserOptions: {
		ecmaVersion: 12,
	},
	rules: {
		semi: 'off',
		'padded-blocks': 'off',
		'object-curly-spacing': [2, 'always'],
		'no-await-in-loop': 'off',
		camelcase: 'off',
		complexity: 'off',
		'capitalized-comments': 'off',
		'no-negated-condition': 'off',
	},
}
