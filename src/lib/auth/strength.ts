import { ZxcvbnFactory } from "@zxcvbn-ts/core";

let factory: Promise<ZxcvbnFactory> | null = null;

/** zxcvbn mit deutschen und allgemeinen Wörterbüchern (lazy geladen; Client und Server). */
function getFactory() {
  if (!factory) {
    factory = Promise.all([import("@zxcvbn-ts/language-common"), import("@zxcvbn-ts/language-de")]).then(
      ([common, de]) =>
        new ZxcvbnFactory({
          dictionary: { ...common.dictionary, ...de.dictionary },
          graphs: common.adjacencyGraphs,
          translations: de.translations,
        }),
    );
  }
  return factory;
}

export async function passwordStrength(password: string, userInputs: string[] = []) {
  const z = await getFactory();
  const r = await z.checkAsync(password, userInputs);
  return { score: r.score, warning: r.feedback.warning ?? "", suggestions: r.feedback.suggestions };
}
