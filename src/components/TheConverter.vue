<script lang="ts" setup>
import { capitalize, ref, watch } from "vue";
import prettier from "prettier";
import parserTypeScript from "prettier/parser-typescript";
import hljs from "highlight.js/lib/core";
import typescript from "highlight.js/lib/languages/typescript";
import "highlight.js/styles/atom-one-dark.css";
import { convertSrc } from "../lib/converter";
import classApi from "../assets/template/classAPI.txt?raw";
import optionsApi from "../assets/template/optionsAPI.txt?raw";

hljs.registerLanguage("typescript", typescript);

const templateMap = new Map([
  ["optionsAPI", optionsApi],
  ["classAPI", classApi],
]);

const input = ref("");
const output = ref("");
const hasError = ref(false);
const templateKeys = Array.from(templateMap.keys());

const selectedTemplate = ref(templateKeys[1]);
watch(
  selectedTemplate,
  async () => {
    hasError.value = false;
    try {
      input.value = templateMap.get(selectedTemplate.value) || "";
      // console.log(input.value);
    } catch (err) {
      hasError.value = true;
      console.error(err);
    }
  },
  { immediate: true }
);

const getImports = (outputText: string) => {
  return (outputText.match(/^import(.*)/gim)?.join("\n") || "")
    .replace(/import\s?{(.*)}\sfrom\s"vue-property-decorator";?/, "")
    .replace(/defineComponent,?/, "")
    .replace(/toRefs,?/, "")
    .replace("@vue/composition-api", "vue");
};

const getProps = (outputText: string) => {
  let props: string | RegExpMatchArray | null = outputText.match(
    /(?<=props:\s{)([\s\S]+?)(?=} },)/
  );

  if (!props) return "";

  props = props[0].replace(/,/gim, ",\n").replace(/\{/gim, "{\n");
  props = props
    .split("},")
    .map((el) => {
      const fields = el.split(",");

      return (
        `${fields[0].split(":")[0]}: {` + fields.slice(1, el.length).join(",")
      );
    })
    .join("},");

  return "const props = defineProps({" + props + "}})";
};

const getSetupFn = (outputText: string) => {
  const setupFn: string | RegExpMatchArray | null = outputText.match(
    /(?<=setup\(_?props,\sctx\)\s{\s)([\s\S]+?)(?=$)/gi
  );

  if (!setupFn?.length) return;

  const lastReturn = setupFn[0]
    .match(/(?<=return\s{\s)([\s\S]+?)(?=})/gi)
    ?.at(-1);

  if (!lastReturn) return;

  const lastImport = outputText.match(/^import(.*)/gim)?.at(-1);
  const middle = !lastImport
    ? ""
    : outputText.slice(
        outputText.indexOf(lastImport) + lastImport.length,
        outputText.indexOf("export default")
      );

  return middle + "\n" + setupFn[0].replace(`${lastReturn}}`, "").slice(0, -18);
};

const addImport = (imports: string, path: string, importName: string) => {
  const clearImportName = importName.replace("{", "").replace("}", "");

  if (imports.includes(path)) {
    if (imports.includes(clearImportName)) return imports;

    const re = `import {(.*)} from "${path}"`;
    const currentImports = imports.match(new RegExp(re))?.[1]?.trim();

    if (!currentImports) return imports;

    if (importName.match(/\{(.*)}/)) {
      return imports.replace(
        currentImports,
        `${currentImports}, ${clearImportName}`
      );
    } else {
      return imports.insert(imports.indexOf(currentImports) - 3, importName);
    }
  }

  return `${imports}\nimport ${importName} from "${path}";`;
};

const handleScriptSetup = (setupBlock: string, imports: string) => {
  let setupBlockHandled = setupBlock;
  let importsHandled = imports;

  if (setupBlockHandled.includes("ctx.emit")) {
    setupBlockHandled = setupBlockHandled.replace(/ctx\.emit/g, "emit");
  }

  if (setupBlockHandled.includes("ctx.root.$t")) {
    setupBlockHandled = setupBlockHandled.replace(/ctx\.root\.\$t/g, "i18n.t");
    importsHandled += addImport(importsHandled, "@/localization", "i18n");
  }

  if (setupBlockHandled.includes("handleError")) {
    setupBlockHandled =
      "\nconst handleError = useHandleError();\n" + setupBlockHandled;
    importsHandled = addImport(
      importsHandled,
      "@/composables",
      "{ useHandleError }"
    );
  }

  if (setupBlockHandled.includes("ctx.root.$router")) {
    setupBlockHandled = setupBlockHandled.replace(
      /ctx\.root\.\$router/,
      "router"
    );
    setupBlockHandled = "\nconst router = useRouter();\n" + setupBlockHandled;
    importsHandled = addImport(
      importsHandled,
      "vue-router/composables",
      "{ useRouter }"
    );
  }

  if (setupBlockHandled.includes("ctx.root.$route")) {
    setupBlockHandled = setupBlockHandled.replace(
      /ctx\.root\.\$route/g,
      "route("
    );
    setupBlockHandled = "\nconst route = useRoute();\n" + setupBlockHandled;
    importsHandled = addImport(
      importsHandled,
      "vue-router/composables",
      "{ useRoute }"
    );
  }

  if (setupBlockHandled.includes("ctx.root.$el")) {
    setupBlockHandled = setupBlockHandled.replace(
      /ctx\.root\.\$el/g,
      "rootEl.value"
    );
    setupBlockHandled =
      `
    // Установить ref="rootEl" на корневой компонент в шаблоне
    const rootEl = ref();\n
    ` + setupBlockHandled;
    importsHandled = addImport(importsHandled, "vue", "{ ref }");
  }

  if (setupBlockHandled.includes("ctx.root.$nextTick")) {
    setupBlockHandled = setupBlockHandled.replace(
      /ctx\.root\.\$nextTick/g,
      "nextTick"
    );

    importsHandled = addImport(importsHandled, "vue", "{ nextTick }");
  }

  if (setupBlockHandled.includes("ctx.root.$mNotify")) {
    setupBlockHandled = setupBlockHandled.replace(
      /ctx\.root\.\$mNotify/g,
      "mNotify"
    );
    importsHandled = addImport(
      importsHandled,
      "@/plugins/MNotify",
      "{ mNotify }"
    );
  }

  if (setupBlockHandled.includes("ctx.root.$adaptive")) {
    setupBlockHandled = setupBlockHandled.replace(
      /ctx\.root\.\$adaptive/g,
      "adaptive"
    );
    setupBlockHandled =
      "\nconst adaptive = useAdaptive();\n" + setupBlockHandled;
    importsHandled = addImport(
      importsHandled,
      "@/plugins/adaptive",
      "{ useAdaptive }"
    );
  }

  const toRefProps = setupBlockHandled.match(/const {(.*)} = toRefs\(props\);/);

  if (toRefProps) {
    setupBlockHandled = setupBlockHandled.replace(toRefProps[0], "");

    // const computedProps = toRefProps[1]
    //   .split(",")
    //   .map((prop) => `const ${prop} = computed(() => props.${prop});`)
    //   .join("\n");
    //
    // setupBlockHandled = computedProps + setupBlockHandled;
    //
    // addImport(importsHandled, "vue", "computed");

    toRefProps[1].split(",").forEach((_prop) => {
      const prop = _prop.trim();

      setupBlockHandled = setupBlockHandled.replace(
        `${prop}.value`,
        `props.${prop}`
      );
    });
  }

  return { setupBlockHandled, importsHandled };
};

const getAsyncImports = (input: string) => {
  let components = input
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

const getEmits = (output: string) => {
  const emitsList = output.match(/(?<=ctx\.emit\(")([\s\S]+?)(?=")/gi);

  if (!emitsList) return "";
  return `const emit = defineEmits([${emitsList
    .map((emit) => `"${emit}"`)
    .join(", ")}]);`;
};

watch(
  input,
  () => {
    try {
      hasError.value = false;
      const outputText = convertSrc(input.value);

      const props = getProps(outputText);
      const emits = getEmits(outputText);
      const setupFn = getSetupFn(outputText);
      let imports = getImports(outputText);
      const asyncImports = getAsyncImports(input.value);

      if (asyncImports)
        imports = addImport(imports, "vue", "{ defineAsyncComponent }");

      const { importsHandled, setupBlockHandled } = setupFn
        ? handleScriptSetup(setupFn, imports)
        : { importsHandled: imports, setupBlockHandled: "" };

      const scriptSetupRes = `${importsHandled}\n${asyncImports}\n${props}\n${emits}\n${setupBlockHandled}`;

      output.value = hljs.highlightAuto(
        prettier.format(scriptSetupRes, {
          parser: "typescript",
          plugins: [parserTypeScript],
        })
      ).value;
    } catch (err) {
      hasError.value = true;
      console.error(err);
    }
  },
  { immediate: true }
);
</script>

<template>
  <div class="flex flex-row h-full">
    <div class="flex-1 flex flex-col">
      <div class="flex flex-row">
        <h2>Input: (Vue2)</h2>
        <select v-model="selectedTemplate" class="border">
          <option v-for="templateItem in templateKeys" :key="templateItem">
            {{ templateItem }}
          </option>
        </select>
      </div>
      <textarea
        class="border w-full text-xs leading-3 flex-1 p-2"
        :class="{ hasError }"
        v-model="input"
      ></textarea>
    </div>
    <div class="flex-1 flex flex-col">
      <h2>Output: script setup</h2>
      <pre
        class="hljs border w-full text-xs leading-3 flex-1 p-2 whitespace-pre-wrap select-all"
        v-html="output"
      />
    </div>
    <div
      class="absolute right-2 top-2 w-16 h-16 bg-white rounded-full p-2 hover:bg-yellow-400"
    >
      <a
        href="https://github.com/miyaoka/vue-composition-converter"
        target="_blank"
        title="repository"
      >
        <img src="../assets/GitHub-Mark-64px.png" />
      </a>
    </div>
  </div>
</template>

<style scoped>
.hasError {
  @apply border-4 border-red-500 outline-none;
}
</style>
