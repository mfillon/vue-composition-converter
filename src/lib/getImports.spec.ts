import { expect, test } from "vitest";
import getImports from "./getImports";

test("getImports: extracts import statements", () => {
  const output = `import { ref } from "vue";\nconst x = 1;`;
  expect(getImports(output)).toBe(`import { ref } from "vue";`);
});

test("getImports: strips vue-property-decorator import", () => {
  const output = `import { Component, Prop } from "vue-property-decorator";\nimport { ref } from "vue";`;
  expect(getImports(output)).toBe(`\nimport { ref } from "vue";`);
});

test("getImports: removes defineComponent from vue import", () => {
  const output = `import { defineComponent, ref } from "vue";`;
  expect(getImports(output)).toBe(`import {  ref } from "vue";`);
});

test("getImports: removes toRefs from vue import", () => {
  const output = `import { toRefs, ref } from "vue";`;
  expect(getImports(output)).toBe(`import {  ref } from "vue";`);
});

test("getImports: replaces @vue/composition-api with vue", () => {
  const output = `import { ref } from "@vue/composition-api";`;
  expect(getImports(output)).toBe(`import { ref } from "vue";`);
});

test("getImports: strips reflect-metadata import", () => {
  const output = `import "reflect-metadata";\nimport { ref } from "vue";`;
  expect(getImports(output)).toBe(`import { ref } from "vue";`);
});

test("getImports: strips reflect-metadata import without semicolon", () => {
  const output = `import "reflect-metadata"\nimport { ref } from "vue";`;
  expect(getImports(output)).toBe(`import { ref } from "vue";`);
});

test("getImports: returns empty string when no imports", () => {
  expect(getImports("const x = 1;")).toBe("");
});
