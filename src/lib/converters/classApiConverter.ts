import ts from "typescript";
import {
  ConvertedExpression,
  getExportStatement,
  getImportStatement,
  lifecycleNameMap,
} from "../helper";
import { convertOptions } from "./options/optionsConverter";

export const convertClass = (
  classNode: ts.ClassDeclaration,
  sourceFile: ts.SourceFile
) => {
  const options = convertOptions(sourceFile);

  const { setupProps, propNames, otherProps } = options || {
    setupProps: [],
    propNames: [],
    otherProps: [],
  };

  const classProps = parseClassNode(classNode, sourceFile);

  const dataProps: ConvertedExpression[] = Array.from(
    classProps.dataMap.entries()
  ).map(([key, val]) => {
    const { type, initializer } = val;
    return {
      use: "ref",
      returnNames: [key],
      expression: `const ${key} = ref${
        type ? `<${type}>` : ""
      }(${initializer})`,
    };
  });

  const computedProps: ConvertedExpression[] = Array.from(
    classProps.getterMap.entries()
  ).map(([key, val]) => {
    const { typeName, block } = val;
    if (classProps.setterMap.has(key)) {
      const setter = classProps.setterMap.get(key);

      return {
        use: "computed",
        expression: `const ${key} = computed({
            get()${typeName} ${block},
            set(${setter.parameters}) ${setter.block}
          })`,
        returnNames: [key],
      };
    }
    return {
      use: "computed",
      expression: `const ${key} = computed(()${typeName} => ${block})`,
      returnNames: [key],
    };
  });
  const methodsProps: ConvertedExpression[] = Array.from(
    classProps.methodsMap.entries()
  ).map(([key, val]) => {
    const { async, type, body, parameters } = val;
    return {
      expression: `${async} function ${key} (${parameters})${type} ${body}`,
      returnNames: [key],
    };
  });
  const watchProps: ConvertedExpression[] = Array.from(
    classProps.watchMap.entries()
  ).map(([key, val]) => {
    const { callback, options } = val;
    return {
      use: "watch",
      expression: `watch(${[key, callback, options]
        .filter((item) => item != null)
        .join(",")})`,
    };
  });
  const lifecycleProps: ConvertedExpression[] = Array.from(
    classProps.lifecycleMap.entries()
  ).map(([key, val]) => {
    const newLifecycleName = lifecycleNameMap.get(key);
    const { async, body, parameters, type } = val;

    const fn = `${async}(${parameters})${type} =>${body}`;
    const immediate = newLifecycleName == null ? "()" : "";

    return {
      use: newLifecycleName,
      expression: `${newLifecycleName ?? ""}(${fn})${immediate}`,
    };
  });
  propNames.push(...Array.from(classProps.propsMap.keys()));

  const propsRefProps: ConvertedExpression[] =
    propNames.length === 0
      ? []
      : [
          {
            use: "toRefs",
            expression: `const { ${propNames.join(",")} } = toRefs(props)`,
            returnNames: propNames,
          },
        ];

  setupProps.push(
    ...propsRefProps,
    ...dataProps,
    ...computedProps,
    ...methodsProps,
    ...watchProps,
    ...lifecycleProps
  );

  const classPropsNode = ts.factory.createPropertyAssignment(
    "props",
    ts.factory.createObjectLiteralExpression(
      Array.from(classProps.propsMap.entries()).map(([key, value]) => {
        const { node } = value;
        return ts.factory.createPropertyAssignment(key, node);
      })
    )
  );
  otherProps.push(...classProps.otherProps, classPropsNode);

  const newSrc = ts.factory.createSourceFile(
    [
      ...getImportStatement([
        ...setupProps,
        ...Array.from(classProps.propsMap.values()).map((prop) => {
          return {
            expression: "",
            use: prop.use,
          };
        }),
      ]),
      ...sourceFile.statements.filter((state) => !ts.isClassDeclaration(state)),
      getExportStatement(setupProps, propNames, otherProps),
    ],
    sourceFile.endOfFileToken,
    sourceFile.flags
  );
  const printer = ts.createPrinter();
  return printer.printFile(newSrc);
};

const parseClassNode = (
  classNode: ts.ClassDeclaration,
  sourceFile: ts.SourceFile
) => {
  const propsMap: Map<
    string,
    { use?: string; node: ts.ObjectLiteralExpression }
  > = new Map();
  const dataMap: Map<string, any> = new Map();
  const getterMap: Map<string, any> = new Map();
  const setterMap: Map<string, any> = new Map();
  const methodsMap: Map<string, any> = new Map();
  const watchMap: Map<string, any> = new Map();
  const lifecycleMap: Map<string, any> = new Map();
  const otherProps: ts.ObjectLiteralElementLike[] = [];

  classNode.members.forEach((member) => {
    const { decorators } = member;
    if (ts.isGetAccessor(member)) {
      // computed method
      const { name: propName, body, type } = member;
      const typeName = type ? `:${type.getText(sourceFile)}` : "";
      const block = body?.getText(sourceFile) || "{}";
      const name = propName.getText(sourceFile);

      getterMap.set(name, {
        typeName,
        block,
      });
    }
    if (ts.isSetAccessor(member)) {
      const { name: propName, body, type } = member;
      const typeName = type ? `:${type.getText(sourceFile)}` : "";
      const block = body?.getText(sourceFile) || "{}";
      const name = propName.getText(sourceFile);
      const parameters = member.parameters
        .map((param) => param.getText(sourceFile))
        .join(",");

      setterMap.set(name, {
        parameters,
        typeName,
        block,
      });
    }
    if (ts.isMethodDeclaration(member)) {
      const name = member.name.getText(sourceFile);

      if (/^(render|data)$/.test(name)) {
        otherProps.push(member);
        return;
      }

      const async = member.modifiers?.some(
        (mod) => mod.kind === ts.SyntaxKind.AsyncKeyword
      )
        ? "async"
        : "";

      const type = member.type ? `:${member.type.getText(sourceFile)}` : "";
      const body = member.body?.getText(sourceFile) || "{}";
      const parameters = member.parameters
        .map((param) => param.getText(sourceFile))
        .join(",");

      const obj = {
        async,
        type,
        body,
        parameters,
      };

      if (lifecycleNameMap.has(name)) {
        lifecycleMap.set(name, obj);
      } else {
        methodsMap.set(name, obj);
      }

      if (decorators) {
        // watch
        const decorator = getDecoratorParams(decorators[0], sourceFile);
        if (!(decorator && decorator.decoratorName === "Watch")) return;

        const [target, options] = decorator.args;
        watchMap.set(target, { callback: name, options });
      }
    }
    if (ts.isPropertyDeclaration(member)) {
      const name = member.name.getText(sourceFile);
      const type = member.type?.getText(sourceFile);
      if (decorators) {
        // props
        const node = parsePropDecorator(decorators[0], sourceFile, type);
        if (node) propsMap.set(name, node);

        return;
      }
      const initializer = member.initializer?.getText(sourceFile);
      dataMap.set(name, {
        type,
        initializer,
      });
    }
  });

  return {
    otherProps,
    propsMap,
    dataMap,
    getterMap,
    setterMap,
    methodsMap,
    watchMap,
    lifecycleMap,
  };
};

const tsTypeToVuePropType = (type?: string) => {
  if (type == null) {
    return { expression: `null` };
  }
  // Helper function to map a single type to Vue runtime type
  const mapSingleTypeToVueType = (singleType: string): string | null => {
    const trimmedType = singleType.trim();

    // Skip null/undefined in runtime validation
    if (trimmedType === 'null' || trimmedType === 'undefined') {
      return null;
    }
    // Primitives
    else if (/^(string|number|boolean)$/.test(trimmedType)) {
      return trimmedType.charAt(0).toUpperCase() + trimmedType.slice(1);
    }
    // Built-in types
    else if (trimmedType === 'Date') {
      return 'Date';
    }
    else if (trimmedType === 'Symbol') {
      return 'Symbol';
    }
    // Function types
    else if (/\(.*\)\s*=>\s*.+/.test(trimmedType) || trimmedType === 'Function') {
      return 'Function';
    }
    // Array types (string[], User[], etc.)
    else if (/\[\]$/.test(trimmedType)) {
      return 'Array';
    }
    // Generic Array types (Array<string>, etc.)
    else if (/^Array<.+>$/.test(trimmedType)) {
      return 'Array';
    }
    // String literals ('pending', "success", etc.)
    else if (/^(['"`]).+\1$/.test(trimmedType)) {
      return 'String';
    }
    // Everything else (objects, interfaces, etc.)
    else {
      return 'Object';
    }
  };

  let vuePropType;

  // Handle union types (anything with |)
  if (type.includes('|')) {
    const unionTypes = type.split('|').map(t => t.trim());
    const vueTypes = unionTypes
      .map(mapSingleTypeToVueType)
      .filter(t => t !== null); // Remove null/undefined

    // Remove duplicates while preserving order
    const uniqueVueTypes = [...new Set(vueTypes)];

    // If no valid runtime types (e.g., "null | undefined"), default to Object
    if (uniqueVueTypes.length === 0) {
      vuePropType = {
        use: "PropType",
        expression: `Object as PropType<${type}>`
      };
    } else if (uniqueVueTypes.length === 1) {
      // Single runtime type - no brackets
      vuePropType = {
        use: "PropType",
        expression: `${uniqueVueTypes[0]} as PropType<${type}>`
      };
    } else {
      // Multiple runtime types - use brackets
      vuePropType = {
        use: "PropType",
        expression: `[${uniqueVueTypes.join(', ')}] as PropType<${type}>`
      };
    }
  }
  // Handle single types
  else {
    const vueType = mapSingleTypeToVueType(type);

    // Handle null/undefined single types
    if (vueType === null) {
      vuePropType = {
        use: "PropType",
        expression: `Object as PropType<${type}>`
      };
    }
    // Primitives, Date, Symbol don't need PropType
    else if (['String', 'Number', 'Boolean', 'Date', 'Symbol'].includes(vueType)) {
      vuePropType = {
        expression: vueType
      };
    }
    // Arrays, Objects, Functions need PropType
    else {
      vuePropType = {
        use: "PropType",
        expression: `${vueType} as PropType<${type}>`
      };
    }
  }

  return vuePropType;
};

const parsePropDecorator = (
  decorator: ts.Decorator,
  sourceFile: ts.SourceFile,
  tsType?: string
) => {
  if (!ts.isCallExpression(decorator.expression)) return null;

  const callExpression = decorator.expression;
  const decoratorName = callExpression.expression.getText(sourceFile);
  if (decoratorName !== "Prop") return null;

  const arg = callExpression.arguments[0];

  const vuePropType = tsTypeToVuePropType(tsType);
  if (arg != null && ts.isObjectLiteralExpression(arg)) {
    if (tsType == null) {
      return {
        node: arg,
      };
    }

    const typeState = ts.createSourceFile(
      "",
      vuePropType.expression,
      ts.ScriptTarget.Latest
    ).statements[0];

    if (ts.isExpressionStatement(typeState)) {
      const options = ts.factory.createObjectLiteralExpression([
        ...arg.properties,
        ts.factory.createPropertyAssignment("type", typeState.expression),
      ]);
      return {
        use: vuePropType.use,
        node: options,
      };
    }
  }

  return {
    use: vuePropType.use,
    node: ts.factory.createObjectLiteralExpression([
      ts.factory.createPropertyAssignment(
        "type",
        ts.factory.createIdentifier(vuePropType.expression)
      ),
    ]),
  };
};
const getDecoratorParams = (
  decorator: ts.Decorator,
  sourceFile: ts.SourceFile
) => {
  // @Prop, @Watch
  if (!ts.isCallExpression(decorator.expression)) return null;

  const callExpression = decorator.expression;
  const decoratorName = callExpression.expression.getText(sourceFile);
  const args = callExpression.arguments.map((arg) => {
    if (ts.isStringLiteral(arg)) {
      return arg.text;
    }
    return arg.getText(sourceFile);
  });

  return {
    decoratorName,
    args,
  };
};

export { tsTypeToVuePropType };
