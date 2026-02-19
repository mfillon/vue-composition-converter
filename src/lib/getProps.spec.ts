import { expect, test } from "vitest";
import getProps, { vueRuntimeTypeToTs } from "./getProps";

// Helper to build a fake intermediate output that getProps can parse.
// Uses single-line format matching what the TypeScript AST printer produces.
const makeOutput = (propsBody: string) =>
  `export default defineComponent({ props: { ${propsBody} }, setup(props, ctx) { return {}; } });`;

// ── vueRuntimeTypeToTs unit tests ─────────────────────────────────────────

test("vueRuntimeTypeToTs: String → string", () => {
  expect(vueRuntimeTypeToTs("String")).toBe("string");
});

test("vueRuntimeTypeToTs: Number → number", () => {
  expect(vueRuntimeTypeToTs("Number")).toBe("number");
});

test("vueRuntimeTypeToTs: Boolean → boolean", () => {
  expect(vueRuntimeTypeToTs("Boolean")).toBe("boolean");
});

test("vueRuntimeTypeToTs: Array → unknown[]", () => {
  expect(vueRuntimeTypeToTs("Array")).toBe("unknown[]");
});

test("vueRuntimeTypeToTs: Object → Record<string, unknown>", () => {
  expect(vueRuntimeTypeToTs("Object")).toBe("Record<string, unknown>");
});

test("vueRuntimeTypeToTs: null → unknown", () => {
  expect(vueRuntimeTypeToTs("null")).toBe("unknown");
});

test("vueRuntimeTypeToTs: PropType<MyType> extracted", () => {
  expect(vueRuntimeTypeToTs("Object as PropType<MyType>")).toBe("MyType");
});

test("vueRuntimeTypeToTs: PropType<string[]> extracted", () => {
  expect(vueRuntimeTypeToTs("Array as PropType<string[]>")).toBe("string[]");
});

test("vueRuntimeTypeToTs: PropType<string | null> extracted", () => {
  expect(vueRuntimeTypeToTs("String as PropType<string | null>")).toBe("string | null");
});

test("vueRuntimeTypeToTs: PropType<string | boolean> extracted", () => {
  expect(vueRuntimeTypeToTs("[String, Boolean] as PropType<string | boolean>")).toBe("string | boolean");
});

test("vueRuntimeTypeToTs: array constructors without PropType", () => {
  expect(vueRuntimeTypeToTs("[String, Number]")).toBe("string | number");
});

test("vueRuntimeTypeToTs: PropType<(id: number) => string> extracted", () => {
  expect(vueRuntimeTypeToTs("Function as PropType<(id: number) => string>")).toBe("(id: number) => string");
});

// ── getProps integration tests ─────────────────────────────────────────────

test("getProps: required string prop", () => {
  const output = makeOutput("label: { type: String, required: true }");
  expect(getProps(output)).toBe("const props = defineProps<{ label: string }>()");
});

test("getProps: optional number with default", () => {
  const output = makeOutput("count: { type: Number, default: 0 }");
  expect(getProps(output)).toBe(
    "const props = withDefaults(defineProps<{ count?: number }>(), { count: 0 })"
  );
});

test("getProps: optional boolean with default", () => {
  const output = makeOutput("visible: { type: Boolean, default: false }");
  expect(getProps(output)).toBe(
    "const props = withDefaults(defineProps<{ visible?: boolean }>(), { visible: false })"
  );
});

test("getProps: optional string with default", () => {
  const output = makeOutput('label: { type: String, default: "hello" }');
  expect(getProps(output)).toBe(
    `const props = withDefaults(defineProps<{ label?: string }>(), { label: "hello" })`
  );
});

test("getProps: optional prop without default or required", () => {
  const output = makeOutput("title: { type: String }");
  expect(getProps(output)).toBe("const props = defineProps<{ title?: string }>()");
});

test("getProps: complex type with PropType", () => {
  const output = makeOutput("item: { type: Object as PropType<MyItem>, required: true }");
  expect(getProps(output)).toBe("const props = defineProps<{ item: MyItem }>()");
});

test("getProps: array type with PropType", () => {
  const output = makeOutput("items: { type: Array as PropType<string[]>, required: true }");
  expect(getProps(output)).toBe("const props = defineProps<{ items: string[] }>()");
});

test("getProps: nullable type", () => {
  const output = makeOutput("value: { type: String as PropType<string | null>, required: true }");
  expect(getProps(output)).toBe("const props = defineProps<{ value: string | null }>()");
});

test("getProps: multiple props with mixed required and default", () => {
  const output = makeOutput(
    "label: { type: String, required: true }, count: { type: Number, default: 0 }, item: { type: Object as PropType<MyItem> }"
  );
  expect(getProps(output)).toBe(
    "const props = withDefaults(defineProps<{ label: string; count?: number; item?: MyItem }>(), { count: 0 })"
  );
});

test("getProps: no props returns empty string", () => {
  const output = `export default defineComponent({ setup(props, ctx) { return {}; } });`;
  expect(getProps(output)).toBe("");
});

// ── @VModel default value ──────────────────────────────────────────────────

test("getProps: @VModel with default injects withDefaults for value prop", () => {
  const output = makeOutput("value: { type: Boolean }");
  const input = `@VModel({ default: false, type: Boolean })\nisFormValid!: boolean;`;
  expect(getProps(output, input)).toBe(
    "const props = withDefaults(defineProps<{ value?: boolean }>(), { value: false })"
  );
});

test("getProps: @VModel without default does not add withDefaults", () => {
  const output = makeOutput("value: { type: Boolean }");
  const input = `@VModel()\nisFormValid!: boolean;`;
  expect(getProps(output, input)).toBe("const props = defineProps<{ value?: boolean }>()");
});

test("getProps: @VModel default with other props", () => {
  const output = makeOutput("value: { type: Boolean }, label: { type: String, required: true }");
  const input = `@VModel({ default: false, type: Boolean })\nisFormValid!: boolean;`;
  expect(getProps(output, input)).toBe(
    "const props = withDefaults(defineProps<{ value?: boolean; label: string }>(), { value: false })"
  );
});
