<script lang="ts" setup>
import { ref, watch } from "vue";
import prettier from "prettier";
import parserTypeScript from "prettier/parser-typescript";
import hljs from "highlight.js/lib/core";
import typescript from "highlight.js/lib/languages/typescript";
import "highlight.js/styles/atom-one-dark.css";
import { convertSrc } from "../lib/converter";
import getSetupFn from "../lib/getSetupFn";
import getProps from "../lib/getProps";
import getEmits from "../lib/getEmits";
import getImports from "../lib/getImports";
import getAsyncImports from "../lib/getAsyncImports";
import addImport from "../lib/addImport";
import handleScriptSetup from "../lib/handleScriptSetup";

hljs.registerLanguage("typescript", typescript);

const input = ref("");
const output = ref("");
const hasError = ref(false);

const selectedTemplate = "classAPI";

watch(
  input,
  () => {
    if (!input.value?.includes("<script")) {
      output.value = "";
      return;
    }
    try {
      hasError.value = false;
      const outputText = convertSrc(input.value);

      const props = getProps(outputText, input.value);
      const emits = getEmits(outputText, input.value);
      const setupFn = getSetupFn(outputText);
      let imports = getImports(outputText);
      const asyncImports = getAsyncImports(input.value);

      if (asyncImports) {
        imports = addImport(imports, "vue", "{ defineAsyncComponent }");
      }

      if (emits.includes("VModelEmit")) {
        imports = addImport(imports, "@/types/vModelTypes", "{ VModelEmit }");
      }

      let { importsHandled, setupBlockHandled } = setupFn
        ? handleScriptSetup(setupFn, imports)
        : { importsHandled: imports, setupBlockHandled: "" };

      const refDecorators = [
        ...input.value.matchAll(/@Ref\(['"](\w+)['"]\)\s*(?:(?:private|public|protected|readonly)\s+)*(\w+)[!?]?\s*:\s*(\w+)/g),
      ];
      for (const [, refName, propName, refType] of refDecorators) {
        if (propName !== refName) {
          const re = new RegExp(`\\b${propName}\\b(?!\\.value)`, "g");
          setupBlockHandled = setupBlockHandled.replace(re, `${refName}.value`);
        }
        // Replace bare member access with optional chaining: refName.value. → refName.value?.
        setupBlockHandled = setupBlockHandled.replace(
          new RegExp(`\\b${refName}\\.value\\.`, "g"),
          `${refName}.value?.`
        );
        // Replace original type with TypeElement in imports
        if (refType && /^[A-Z]/.test(refType) && !refType.endsWith("Element")) {
          importsHandled = importsHandled.replace(
            new RegExp(`\\b${refType}\\b`, "g"),
            `${refType}Element`
          );
        }
      }

      const vmodelMatch = /@VModel\([^)]*\)\s*(\w+)[!?]?\s*:/.exec(input.value);
      if (vmodelMatch) {
        const propName = vmodelMatch[1];
        setupBlockHandled = setupBlockHandled.replace(/props\.value\b/g, `${propName}.value`);
        const bareNameRe = new RegExp(`\\b${propName}\\b(?!\\.value)`, "g");
        setupBlockHandled = setupBlockHandled.replace(bareNameRe, `${propName}.value`);
        setupBlockHandled = `const ${propName} = useVModel(props, emit);\n` + setupBlockHandled;
        importsHandled = addImport(importsHandled, "@/composables/technical/useVModel", "{ useVModel }");
      }

      const scriptSetupRes = `${importsHandled}\n${asyncImports}\n${props}\n${emits}\n${setupBlockHandled}`;

      const template = input.value.match(/<template[\s\S]*?<\/template>/)?.[0] ?? "";
      const style = input.value.match(/<style[\s\S]*?<\/style>/)?.[0] ?? "";

      const escapeHtml = (s: string) =>
        s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

      const closeScriptTag = "<" + "/script>";
      const wrapSfc = (highlightedScript: string) =>
        [
          template ? escapeHtml(template) : "",
          `<span class="hljs-meta">&lt;script lang="ts" setup&gt;</span>\n${highlightedScript}<span class="hljs-meta">${escapeHtml(closeScriptTag)}</span>`,
          style ? escapeHtml(style) : "",
        ]
          .filter(Boolean)
          .join("\n\n");

      try {
        const formattedScript = prettier.format(scriptSetupRes, {
          parser: "typescript",
          plugins: [parserTypeScript]
        });
        const highlighted = hljs.highlight(formattedScript, { language: "typescript" }).value;
        output.value = wrapSfc(highlighted);
      } catch (e) {
        hasError.value = true;
        console.error(
          "Error formatting/highlighting code. Outputting raw code",
          e
        );
        output.value = wrapSfc(escapeHtml(scriptSetupRes));
      }
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
          <option>classAPI</option>
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
