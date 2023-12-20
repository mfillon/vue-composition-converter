import { capitalize } from "vue";

const getAsyncImports = (input: string) => {
  const components = input
    .match(/(?<=components: {)([\s\S]+?)(?=})/)?.[0]
    .match(/(.*):\s\(\)\s=>\simport\('(.*)'\)/gi);

  if (!components) return "";

  return components
    .map((component) => {
      const [componentName, importFn] = component.trim().split(":");

      return `const ${capitalize(
        componentName
      )} = defineAsyncComponent(${importFn})`;
    })
    .join("\n");
};

export default getAsyncImports;
