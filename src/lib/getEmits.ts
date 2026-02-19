const getEmits = (output: string, input: string) => {
  const outputEmitsList =
    output.match(/(?<=ctx\.emit\(")([\s\S]+?)(?=")/gi) || [];
  const inputsClassEmits = input.match(/(?<=@Emit\()([\s\S]+?)(?=\))/gim) || [];

  const emitTypeMap: Map<string, string> = new Map();

  // 1. @Emit('name') decorator + method return type (highest precedence, class API)
  //    Captures: @Emit('name') [modifiers] methodName([params]): ReturnType {
  const emitWithTypeRe =
    /@Emit\((['"][^'"]*['"])\)\s*(?:(?:public|private|protected|async|readonly)\s+)*\w+\s*(?:<[^>]*>)?\s*\([^)]*\)\s*:\s*([^{]+?)\s*\{/gm;
  let m;
  while ((m = emitWithTypeRe.exec(input)) !== null) {
    emitTypeMap.set(m[1].replaceAll('"', "'"), m[2].trim());
  }

  // 2. this.$emit("event", arg) / $emit("event", arg) in script or template.
  //    Look up arg's type annotation anywhere in the source.
  const inputEmitNames: string[] = [];
  const emitWithArgRe = /(?:this\.)?\$emit\(['"]([^'"]+)['"]\s*,\s*(\w+)/gm;
  while ((m = emitWithArgRe.exec(input)) !== null) {
    const quotedName = `'${m[1]}'`;
    const argName = m[2];
    inputEmitNames.push(quotedName);
    if (!emitTypeMap.has(quotedName)) {
      // Match "argName?: Type" or "argName!: Type" or "argName: Type" as a declaration/parameter.
      // Stops at =  ;  ,  )  {  }  or newline so it works for both params and class fields.
      const typeRe = new RegExp(
        `\\b${argName}\\s*[!?]?\\s*:\\s*([^=;,){}\\n]+?)\\s*(?=[=;,){}\\n])`,
        "m"
      );
      const typeMatch = typeRe.exec(input);
      emitTypeMap.set(quotedName, typeMatch ? typeMatch[1].trim() : "any");
    }
  }

  // 3. this.$emit("event") / $emit("event") without a payload argument → void.
  const emitNoArgRe = /(?:this\.)?\$emit\(['"]([^'"]+)['"]\s*\)/gm;
  while ((m = emitNoArgRe.exec(input)) !== null) {
    const quotedName = `'${m[1]}'`;
    inputEmitNames.push(quotedName);
    if (!emitTypeMap.has(quotedName)) {
      emitTypeMap.set(quotedName, "void");
    }
  }

  if (!outputEmitsList.length && !inputsClassEmits.length && !inputEmitNames.length) return "";

  const emitsList = [
    ...new Set([
      ...outputEmitsList.map((emit) => `'${emit}'`),
      ...inputsClassEmits.map((emit) => emit.replaceAll('"', "'")),
      ...inputEmitNames,
    ]),
  ];

  const signatures = emitsList
    .map((e) => {
      const valueType = emitTypeMap.get(e);
      if (valueType === "void") {
        return `  (e: ${e}): void;`;
      }
      return `  (e: ${e}, v: ${valueType ?? "any"}): void;`;
    })
    .join("\n");

  return `interface Emits {\n${signatures}\n}\nconst emit = defineEmits<Emits>();`;
};

export default getEmits;
