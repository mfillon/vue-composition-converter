import { expect, test } from "vitest";
import { tsTypeToVuePropType } from "./classApiConverter";

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
