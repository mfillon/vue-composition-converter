import { expect, test } from "vitest";
import getEmits from "./getEmits";

test("getEmits: returns empty string when no emits", () => {
  expect(getEmits("no emits here", "no emits here")).toBe("");
});

// ── ctx.emit in converted output (options API, unknown type → any) ─────────

test("getEmits: ctx.emit without type info → any", () => {
  expect(getEmits(`ctx.emit("update")`, "")).toBe(
    `interface Emits {\n  (e: 'update', v: any): void;\n}\nconst emit = defineEmits<Emits>();`
  );
});

test("getEmits: multiple ctx.emit calls", () => {
  expect(getEmits(`ctx.emit("update"); ctx.emit("close")`, "")).toBe(
    `interface Emits {\n  (e: 'update', v: any): void;\n  (e: 'close', v: any): void;\n}\nconst emit = defineEmits<Emits>();`
  );
});

// ── @Emit decorator (class API) ───────────────────────────────────────────

test("getEmits: @Emit without parseable method signature → any", () => {
  expect(getEmits("", `@Emit('submit')`)).toBe(
    `interface Emits {\n  (e: 'submit', v: any): void;\n}\nconst emit = defineEmits<Emits>();`
  );
});

test("getEmits: @Emit with boolean return type", () => {
  expect(getEmits("", `@Emit('update')\nonUpdate(): boolean {\n  return true;\n}`)).toBe(
    `interface Emits {\n  (e: 'update', v: boolean): void;\n}\nconst emit = defineEmits<Emits>();`
  );
});

test("getEmits: @Emit with void return type omits value parameter", () => {
  expect(getEmits("", `@Emit('close')\nonClose(): void {\n}`)).toBe(
    `interface Emits {\n  (e: 'close'): void;\n}\nconst emit = defineEmits<Emits>();`
  );
});

test("getEmits: @Emit with union return type", () => {
  expect(getEmits("", `@Emit('change')\nonChange(): string | null {\n  return null;\n}`)).toBe(
    `interface Emits {\n  (e: 'change', v: string | null): void;\n}\nconst emit = defineEmits<Emits>();`
  );
});

test("getEmits: @Emit with custom type", () => {
  expect(getEmits("", `@Emit('select')\nonSelect(): MyItem {\n  return this.item;\n}`)).toBe(
    `interface Emits {\n  (e: 'select', v: MyItem): void;\n}\nconst emit = defineEmits<Emits>();`
  );
});

test("getEmits: @Emit with access modifier", () => {
  expect(getEmits("", `@Emit('update')\npublic onUpdate(): number {\n  return 1;\n}`)).toBe(
    `interface Emits {\n  (e: 'update', v: number): void;\n}\nconst emit = defineEmits<Emits>();`
  );
});

test("getEmits: @Emit with double-quoted event name", () => {
  expect(getEmits("", `@Emit("update")\nonUpdate(): string {\n  return "";\n}`)).toBe(
    `interface Emits {\n  (e: 'update', v: string): void;\n}\nconst emit = defineEmits<Emits>();`
  );
});

// ── this.$emit / $emit with typed argument ────────────────────────────────

test("getEmits: this.$emit with typed method parameter", () => {
  const input = `
    click(item: ItemType) {
      this.$emit("click", item);
    }`;
  expect(getEmits("", input)).toBe(
    `interface Emits {\n  (e: 'click', v: ItemType): void;\n}\nconst emit = defineEmits<Emits>();`
  );
});

test("getEmits: this.$emit with union-typed parameter", () => {
  const input = `
    update(value: string | null) {
      this.$emit("update", value);
    }`;
  expect(getEmits("", input)).toBe(
    `interface Emits {\n  (e: 'update', v: string | null): void;\n}\nconst emit = defineEmits<Emits>();`
  );
});

test("getEmits: this.$emit with untyped arg falls back to any", () => {
  const input = `
    click(item) {
      this.$emit("click", item);
    }`;
  expect(getEmits("", input)).toBe(
    `interface Emits {\n  (e: 'click', v: any): void;\n}\nconst emit = defineEmits<Emits>();`
  );
});

// ── this.$emit / $emit with no payload → void ─────────────────────────────

test("getEmits: this.$emit without payload", () => {
  expect(getEmits("", `this.$emit("close");`)).toBe(
    `interface Emits {\n  (e: 'close'): void;\n}\nconst emit = defineEmits<Emits>();`
  );
});

test("getEmits: $emit in template without payload", () => {
  expect(getEmits("", `@click="$emit('close')"`)).toBe(
    `interface Emits {\n  (e: 'close'): void;\n}\nconst emit = defineEmits<Emits>();`
  );
});

// ── $emit in template with typed source ───────────────────────────────────

test("getEmits: $emit in template with class prop type", () => {
  const input = `
<template>
  <div @click="$emit('select', item)"></div>
</template>
<script>
  @Prop() item!: ItemType;
</script>`;
  expect(getEmits("", input)).toBe(
    `interface Emits {\n  (e: 'select', v: ItemType): void;\n}\nconst emit = defineEmits<Emits>();`
  );
});

// ── precedence and deduplication ──────────────────────────────────────────

test("getEmits: @Emit type takes precedence over this.$emit inference", () => {
  const input = `
    @Emit('update')
    onUpdate(): boolean {
      this.$emit("update", someOtherThing);
      return true;
    }`;
  expect(getEmits("", input)).toBe(
    `interface Emits {\n  (e: 'update', v: boolean): void;\n}\nconst emit = defineEmits<Emits>();`
  );
});

test("getEmits: this.$emit typed arg takes precedence over no-arg emit", () => {
  // emitWithArgRe runs before emitNoArgRe, so typed call wins
  const input = `
    this.$emit("update", value);
    this.$emit("update");`;
  // "value" has no type annotation → any, but the arg call is first
  expect(getEmits("", input)).toBe(
    `interface Emits {\n  (e: 'update', v: any): void;\n}\nconst emit = defineEmits<Emits>();`
  );
});

test("getEmits: deduplicates same event from ctx.emit and @Emit", () => {
  const input = `@Emit('update')\nonUpdate(): boolean {\n  return true;\n}`;
  expect(getEmits(`ctx.emit("update")`, input)).toBe(
    `interface Emits {\n  (e: 'update', v: boolean): void;\n}\nconst emit = defineEmits<Emits>();`
  );
});

test("getEmits: merges typed @Emit and untyped ctx.emit", () => {
  const input = `@Emit('submit')\nonSubmit(): void {\n}`;
  expect(getEmits(`ctx.emit("change")`, input)).toBe(
    `interface Emits {\n  (e: 'change', v: any): void;\n  (e: 'submit'): void;\n}\nconst emit = defineEmits<Emits>();`
  );
});

test("getEmits: multiple @Emit methods with mixed types", () => {
  const input = [
    `@Emit('update')\nonUpdate(): boolean {\n  return true;\n}`,
    `@Emit('close')\nonClose(): void {\n}`,
    `@Emit('select')\nonSelect(): string {\n  return "";\n}`,
  ].join("\n");
  expect(getEmits("", input)).toBe(
    `interface Emits {\n  (e: 'update', v: boolean): void;\n  (e: 'close'): void;\n  (e: 'select', v: string): void;\n}\nconst emit = defineEmits<Emits>();`
  );
});
