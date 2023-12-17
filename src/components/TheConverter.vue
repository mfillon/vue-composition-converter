<script lang="ts" setup>
import { ref, watch } from "vue";
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
//(?<=setup\(props\,\sctx\)\s{\s)([\s\S]+?)(?=$)
//(?<=return\s{\s)([\s\S]+?)(?=\})
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
      console.log(input.value);
    } catch (err) {
      hasError.value = true;
      console.error(err);
    }
  },
  { immediate: true }
);

watch(
  input,
  () => {
    try {
      hasError.value = false;
      const outputText = convertSrc(input.value);

      let props: string | RegExpMatchArray | null = outputText.match(
        /(?<=props:\s{)([\s\S]+?)(?=} },)/
      );
      props = props?.[0]
        ? "const props = defineProps({" + props[0] + "}})"
        : null;
      let setupFn: string | RegExpMatchArray | null = outputText.match(
        /(?<=setup\(props,\sctx\)\s{\s)([\s\S]+?)(?=$)/gi
      );
      if (!setupFn?.length) return;

      const lastReturn = setupFn[0]
        .match(/(?<=return\s{\s)([\s\S]+?)(?=})/gi)
        ?.at(-1);

      if (!lastReturn) return;

      setupFn = setupFn[0].replace(lastReturn, "").slice(0, -20);

      const imports = outputText.slice(
        0,
        outputText.indexOf("export default defineComponent")
      );

      const scriptSetupRes = `${imports}\n${props}\n${setupFn}`;

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
      <h2>Output: (Vue2 / Composition API)</h2>
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
