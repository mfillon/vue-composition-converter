const getEmits = (output: string, input: string) => {
  const outputEmitsList =
    output.match(/(?<=ctx\.emit\(")([\s\S]+?)(?=")/gi) || [];
  const inputsClassEmits = input.match(/(?<=@Emit\()([\s\S]+?)(?=\))/gim) || [];

  if (!outputEmitsList.length && !inputsClassEmits.length) return "";
  const emitsList = [
    ...new Set([
      ...outputEmitsList.map((emit) => `'${emit}'`),
      ...inputsClassEmits.map((emit) => emit.replaceAll('"', "'")),
    ]),
  ];
  const signatures = emitsList.map((e) => `  (e: ${e}): void;`).join("\n");
  return `interface Emits {\n${signatures}\n}\nconst emit = defineEmits<Emits>();`;
};

export default getEmits;
