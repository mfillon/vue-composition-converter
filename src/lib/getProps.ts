const vueConstructorToTs = (constructor: string): string => {
  const map: Record<string, string> = {
    String: 'string',
    Number: 'number',
    Boolean: 'boolean',
    Array: 'unknown[]',
    Object: 'Record<string, unknown>',
    Function: '(...args: any[]) => any',
    Date: 'Date',
    Symbol: 'symbol',
  };
  return map[constructor] ?? constructor;
};

export const vueRuntimeTypeToTs = (typeStr: string): string => {
  if (!typeStr || typeStr === 'null') return 'unknown';

  // Extract TypeScript type from "X as PropType<Y>" or just "PropType<Y>"
  const propTypeMatch = typeStr.match(/PropType<(.+)>$/i);
  if (propTypeMatch) return propTypeMatch[1].trim();

  // Strip any trailing " as X" cast and work with the constructor part
  const beforeAs = typeStr.split(' as ')[0].trim();

  // Array of constructors: [String, Number] → string | number
  const arrayMatch = beforeAs.match(/^\[(.+)\]$/);
  if (arrayMatch) {
    return arrayMatch[1].split(',').map(t => vueConstructorToTs(t.trim())).join(' | ');
  }

  return vueConstructorToTs(beforeAs);
};

const getProps = (outputText: string, input?: string) => {
  let props: string | RegExpMatchArray | null | string[] = outputText.match(
    /(?<=props:\s{)([\s\S]+?)(?=} },)/
  );
  if (!props) return "";

  props = props[0].replace(/,/gim, ",\n").replace(/\{/gim, "{\n");
  props = props.split("},");

  const typeEntries: string[] = [];
  const defaultEntries: string[] = [];

  props
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
    .forEach((el) => {
      if (!el) return;

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
      if (!propName) return;

      const splittedProp = cleanProp
        .replace(/\[([^\]]+)\]/g, (match) => match.replace(/,/g, '|COMMA|'))
        .split(',')
        .map(part => part.replace(/\|COMMA\|/g, ','));

      const fieldMap: Record<string, string> = {};

      splittedProp.forEach((field) => {
        const colonIdx = field.indexOf(':');
        if (colonIdx === -1) return;
        const key = field.slice(0, colonIdx).trim();
        const value = field.slice(colonIdx + 1).trim();
        if (key) fieldMap[key] = value;
      });

      let { type, default: defaultField, required } = fieldMap;
      if (!type) return;

      type = type.replace("Proptype", "PropType");

      const tsType = vueRuntimeTypeToTs(type);
      const isRequired = required === 'true' && !defaultField;

      typeEntries.push(`${propName}${isRequired ? '' : '?'}: ${tsType}`);

      if (defaultField) {
        defaultEntries.push(`${propName}: ${defaultField}`);
      }
    });

  if (input) {
    const vmodelDefaultMatch = /@VModel\(\{[^}]*default:\s*([^,}]+)/.exec(input);
    if (vmodelDefaultMatch && !defaultEntries.some((e) => e.startsWith("value:"))) {
      defaultEntries.push(`value: ${vmodelDefaultMatch[1].trim()}`);
    }
  }

  if (typeEntries.length === 0) return "";

  const typeBody = typeEntries.join('; ');
  const definePropsCall = `defineProps<{ ${typeBody} }>()`;

  if (defaultEntries.length > 0) {
    return `const props = withDefaults(${definePropsCall}, { ${defaultEntries.join(', ')} })`;
  }

  return `const props = ${definePropsCall}`;
};

export default getProps;
