import withNuxt from "./.nuxt/eslint.config.mjs";
import chariz from "eslint-config-chariz";

export default withNuxt(
	...chariz({
		ts: false
	}),
	{
		rules: {
			"vue/multi-word-component-names": "off"
		}
	}
);
