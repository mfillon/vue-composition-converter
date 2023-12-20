const getProps = (outputText: string) => {
  let props: string | RegExpMatchArray | null | string[] = outputText.match(
    /(?<=props:\s{)([\s\S]+?)(?=} },)/
  );

  if (!props) return "";

  props = props[0].replace(/,/gim, ",\n").replace(/\{/gim, "{\n");
  props = props.split("},");

  props = props
    .map((_el) => {
      const el = _el.replace(/type:\s?(.*)?\n?(.*)?\n?(.*)\n?(.*)],/gm, "");
      const typesFieldsAmount = el.match(/type/gm);

      if (typesFieldsAmount?.length === 1) return el;

      let fields = el.split(",");
      const [fieldName, _, firstType] = fields[0].split(":");

      fields = fields.map((field) =>
        field.replace(/type:\s\w+\sas/gm, `type: ${firstType} as `)
      );

      return `${fieldName}: {` + fields.slice(1, el.length).join(",");
    })
    .join("},");

  return "const props = defineProps({" + props + "}})";
};

export default getProps;
