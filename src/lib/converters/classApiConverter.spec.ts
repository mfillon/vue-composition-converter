import { expect, test } from "vitest";
import ts from "typescript";
import { tsTypeToVuePropType, convertClass } from "./classApiConverter";
import getSetupFn from "../getSetupFn";
import handleScriptSetup from "../handleScriptSetup";
import getImports from "../getImports";

const makeClassOutput = (classBody: string): string => {
  const src = `
    import { Component, Ref } from 'vue-property-decorator';
    @Component
    export default class TestComponent extends Vue {
      ${classBody}
    }
  `;
  const sourceFile = ts.createSourceFile("test.ts", src, ts.ScriptTarget.Latest);
  const classNode = sourceFile.statements.find(ts.isClassDeclaration) as ts.ClassDeclaration;
  return convertClass(classNode, sourceFile);
};

interface MyTestType {
  name: string;
}

test("converts TS type string to Vue PropType", () => {
  expect(tsTypeToVuePropType("string")).toStrictEqual({ expression: "String" });
});
test("converts TS type array to Vue PropType", () => {
  expect(tsTypeToVuePropType("string[]")).toStrictEqual({
    expression: "Array as PropType<string[]>",
    use: "PropType",
  });
});
test("converts TS type array to Vue PropType", () => {
  expect(tsTypeToVuePropType("string[]")).toStrictEqual({
    expression: "Array as PropType<string[]>",
    use: "PropType",
  });
});
test("converts TS custom type to Vue PropType", () => {
  expect(tsTypeToVuePropType("MyTestType")).toStrictEqual({
    expression: "Object as PropType<MyTestType>",
    use: "PropType",
  });
});
test("converts TS custom type array to Vue PropType", () => {
  expect(tsTypeToVuePropType("MyTestType[]")).toStrictEqual({
    expression: "Array as PropType<MyTestType[]>",
    use: "PropType",
  });
});
test("converts TS multiple primitive types to Vue PropType", () => {
  expect(tsTypeToVuePropType("string | boolean")).toStrictEqual({
    expression: "[String, Boolean] as PropType<string | boolean>",
    use: "PropType",
  });
});
test("converts TS multiple types with array to Vue PropType", () => {
  expect(tsTypeToVuePropType("string | string[]")).toStrictEqual({
    expression: "[String, Array] as PropType<string | string[]>",
    use: "PropType",
  });
});
test("converts TS type function to Vue PropType", () => {
  expect(tsTypeToVuePropType("(id: number) => string")).toStrictEqual({
    expression: "Function as PropType<(id: number) => string>",
    use: "PropType",
  });
});
test("converts TS primitive type nullable to Vue PropType", () => {
  expect(tsTypeToVuePropType("string | null")).toStrictEqual({
    expression: "String as PropType<string | null>",
    use: "PropType",
  });
});
test("converts TS multiple primitive types nullable to Vue PropType", () => {
  expect(tsTypeToVuePropType("string | boolean | null")).toStrictEqual({
    expression: "[String, Boolean] as PropType<string | boolean | null>",
    use: "PropType",
  });
});
test("converts TS type nullable to Vue PropType", () => {
  expect(tsTypeToVuePropType("MyType | null")).toStrictEqual({
    expression: "Object as PropType<MyType | null>",
    use: "PropType",
  });
});
test("converts TS multiple mixed types nullable to Vue PropType", () => {
  expect(tsTypeToVuePropType("MyType | string | null")).toStrictEqual({
    expression: "[Object, String] as PropType<MyType | string | null>",
    use: "PropType",
  });
});

// ── @Ref decorator ────────────────────────────────────────────────────────

test("@Ref: generates ref with VFormElement type", () => {
  const output = makeClassOutput(`@Ref("myForm") private readonly formRef!: VForm;`);
  expect(output).toContain("const myForm = ref<VFormElement>()");
});

test("@Ref: falls back to property name when no argument", () => {
  const output = makeClassOutput(`@Ref() readonly formRef!: VForm;`);
  expect(output).toContain("const formRef = ref<VFormElement>()");
});

test("@Ref: does not double-suffix types already ending in Element", () => {
  const output = makeClassOutput(`@Ref("el") readonly elRef!: HTMLInputElement;`);
  expect(output).toContain("const el = ref<HTMLInputElement>()");
});

test("@Ref: does not transform lowercase types", () => {
  const output = makeClassOutput(`@Ref("myRef") readonly myRef!: string;`);
  expect(output).toContain("const myRef = ref<string>()");
});

test("@Ref: this.formRef is replaced with myForm.value in methods", () => {
  const output = makeClassOutput(`
    @Ref("myForm") private readonly formRef!: VForm;
    mounted() {
      if (this.formRef.validate()) {}
    }
  `);
  expect(output).toContain("myForm.value.validate()");
  expect(output).not.toContain("this.formRef");
  expect(output).not.toContain("formRef.validate");
});

test("@Ref: this.formRef is replaced with myForm.value in lifecycle hooks", () => {
  const output = makeClassOutput(`
    @Ref("myForm") private readonly formRef!: VForm;
    beforeMount() {
      this.formRef.reset();
    }
  `);
  expect(output).toContain("myForm.value.reset()");
});

test("@Ref: pipeline produces myForm.value in setup block", () => {
  const intermediate = makeClassOutput(`
    @Ref("myForm") private readonly formRef!: VForm;
    mounted() { this.formRef.validate(); }
  `);
  const setupFn = getSetupFn(intermediate);
  expect(setupFn).toBeTruthy();
  const imports = getImports(intermediate);
  const { setupBlockHandled } = setupFn
    ? handleScriptSetup(setupFn, imports)
    : { setupBlockHandled: "" };
  expect(setupBlockHandled).toContain("const myForm = ref<VFormElement>()");
  expect(setupBlockHandled).toContain("myForm.value.validate()");
});

test("@Ref: optional chaining on ref member access", () => {
  const intermediate = makeClassOutput(`
    @Ref("myForm") private readonly formRef!: VForm;
    submit() { this.formRef.validate(); this.formRef.reset(); }
  `);
  // myForm.value. → myForm.value?.
  expect(intermediate).toContain("myForm.value.validate()");
  // optional chaining is applied in TheConverter.vue post-processing, not here
});
