import { expect, test } from "vitest";
import getEmits from "./getEmits";

test("getEmits: returns empty string when no emits", () => {
  expect(getEmits("no emits here", "no emits here")).toBe("");
});

test("getEmits: extracts emit from ctx.emit call", () => {
  const output = `ctx.emit("update")`;
  expect(getEmits(output, "")).toBe(
    `interface Emits {\n  (e: 'update'): void;\n}\nconst emit = defineEmits<Emits>();`
  );
});

test("getEmits: extracts multiple emits from ctx.emit calls", () => {
  const output = `ctx.emit("update"); ctx.emit("close")`;
  expect(getEmits(output, "")).toBe(
    `interface Emits {\n  (e: 'update'): void;\n  (e: 'close'): void;\n}\nconst emit = defineEmits<Emits>();`
  );
});

test("getEmits: extracts emit from @Emit decorator", () => {
  const input = `@Emit('submit')`;
  expect(getEmits("", input)).toBe(
    `interface Emits {\n  (e: 'submit'): void;\n}\nconst emit = defineEmits<Emits>();`
  );
});

test("getEmits: deduplicates emits from both sources", () => {
  const output = `ctx.emit("update")`;
  const input = `@Emit('update')`;
  expect(getEmits(output, input)).toBe(
    `interface Emits {\n  (e: 'update'): void;\n}\nconst emit = defineEmits<Emits>();`
  );
});

test("getEmits: merges emits from ctx.emit and @Emit", () => {
  const output = `ctx.emit("change")`;
  const input = `@Emit('submit')`;
  expect(getEmits(output, input)).toBe(
    `interface Emits {\n  (e: 'change'): void;\n  (e: 'submit'): void;\n}\nconst emit = defineEmits<Emits>();`
  );
});
