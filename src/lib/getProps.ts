const getProps = (outputText: string) => {
  let props: string | RegExpMatchArray | null | string[] = outputText.match(
    /(?<=props:\s{)([\s\S]+?)(?=} },)/
  );
  if (!props) return "";

  props = props[0].replace(/,/gim, ",\n").replace(/\{/gim, "{\n");
  props = props.split("},");

  props = props
    .map((_el) => {
      const el = _el.replace(/type:\n],/gm, "");
      const typesFieldsAmount = el.match(/type/gm);

      if (typesFieldsAmount?.length === 1) return el;

      let fields = el.split(",");
      const [fieldName, _, firstType] = fields[0].split(":");

      fields = fields.map((field) =>
        field.replace(/type:\s\w+\sas/gm, `type: ${firstType} as `)
      );

      return `${fieldName}: {` + fields.slice(1, el.length).join(",");
    })
    .map((el) => {
      let propName = "";
      const cleanProp = el
        .replace(/(?<=^)([\s\S]+?)(?={)/gm, (match) => {
          propName = match;
          return "";
        })
        .replace("{", "")
        .replace(/\n/gm, "")
        .replace(/\s+/gm, " ")
        .trim();

      propName = propName.replace(/[^\w]/g, "");

      const splittedProp = cleanProp.split(",");

      const fields: any = {};

      splittedProp.forEach((field) => {
        const [fieldName, fieldValue] = field.split(":");
        fields[fieldName.trim()] = fieldValue.trim();
      });

      const res: any = {};

      const { type, default: defaultField, required } = fields;

      res.type = type;

      if (defaultField) res.default = defaultField;

      if (required && !defaultField) {
        res.required = fields[required];
      }

      if (
        (defaultField === "null" || defaultField === "undefined") &&
        !res.type.toLowerCase().includes("proptype")
      ) {
        res.type = `${
          res.type
        } as PropType<${res.type.toLowerCase()} | ${defaultField}>`;
      }

      res.type = res.type.replace("Proptype", "PropType");

      let resString = `${propName}: {\n`;

      Object.entries(res).forEach(([k, v]) => {
        resString += `${k}: ${v},\n`;
      });

      resString += "}";

      return resString;
    });

  return "const props = defineProps({" + props + "})";
};

export default getProps;
