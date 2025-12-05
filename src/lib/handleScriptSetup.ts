import addImport from "./addImport";

const handleScriptSetup = (setupBlock: string, imports: string) => {
  let setupBlockHandled = setupBlock;
  let importsHandled = imports;

  if (setupBlockHandled.includes("ctx.emit")) {
    setupBlockHandled = setupBlockHandled.replace(/ctx\.emit/g, "emit");
  }

  if (setupBlockHandled.includes("ctx.root.$t")) {
    setupBlockHandled = setupBlockHandled.replace(/ctx\.root\.\$t/g, "i18n.t");
    importsHandled = addImport(importsHandled, "@/i18n", "i18n");
  }

  if (setupBlockHandled.includes("handleError")) {
    setupBlockHandled =
      "\nconst handleError = useHandleError();\n" + setupBlockHandled;
    importsHandled = addImport(
      importsHandled,
      "@/composables",
      "{ useHandleError }"
    );
  }

  if (setupBlockHandled.includes("ctx.root.$router")) {
    setupBlockHandled = setupBlockHandled.replace(
      /ctx\.root\.\$router/,
      "router"
    );
    setupBlockHandled = "\nconst router = useRouter();\n" + setupBlockHandled;
    importsHandled = addImport(
      importsHandled,
      "vue-router/composables",
      "{ useRouter }"
    );
  }

  if (setupBlockHandled.includes("ctx.root.$route")) {
    setupBlockHandled = setupBlockHandled.replace(
      /ctx\.root\.\$route/g,
      "route"
    );
    setupBlockHandled = "\nconst route = useRoute();\n" + setupBlockHandled;
    importsHandled = addImport(
      importsHandled,
      "vue-router/composables",
      "{ useRoute }"
    );
  }

  if (setupBlockHandled.includes("ctx.root.$el")) {
    setupBlockHandled = setupBlockHandled.replace(
      /ctx\.root\.\$el/g,
      "rootEl.value"
    );
    setupBlockHandled =
      `
    // Установить ref="rootEl" на корневой компонент в шаблоне
    const rootEl = ref<Element>();\n
    ` + setupBlockHandled;
    importsHandled = addImport(importsHandled, "vue", "{ ref }");
  }

  if (setupBlockHandled.includes("ctx.root.$nextTick")) {
    setupBlockHandled = setupBlockHandled.replace(
      /ctx\.root\.\$nextTick/g,
      "nextTick"
    );

    importsHandled = addImport(importsHandled, "vue", "{ nextTick }");
  }

  if (setupBlockHandled.includes("ctx.root.$mNotify")) {
    setupBlockHandled = setupBlockHandled.replace(
      /ctx\.root\.\$mNotify/g,
      "mNotify"
    );
    importsHandled = addImport(
      importsHandled,
      "@/plugins/MNotify",
      "{ mNotify }"
    );
  }

  if (setupBlockHandled.includes("ctx.root.$adaptive")) {
    setupBlockHandled = setupBlockHandled.replace(
      /ctx\.root\.\$adaptive/g,
      "adaptive"
    );
    setupBlockHandled =
      "\nconst adaptive = useAdaptive();\n" + setupBlockHandled;
    importsHandled = addImport(
      importsHandled,
      "@/plugins/adaptive",
      "{ useAdaptive }"
    );
  }

  const toRefProps = setupBlockHandled.match(/const {(.*)} = toRefs\(props\);/);

  if (toRefProps) {
    setupBlockHandled = setupBlockHandled.replace(toRefProps[0], "");

    toRefProps[1].split(",").forEach((_prop) => {
      const prop = _prop.trim();
      const re = new RegExp(`${prop}.value`, "gim");

      setupBlockHandled = setupBlockHandled.replace(re, `props.${prop}`);
    });
  }

  const computedTypesToGeneric = setupBlockHandled.match(
    /(?<=computed\(\(\): )([\s\S]+?)(?=\s=>)/gm
  );

  computedTypesToGeneric?.forEach((typeName) => {
    const str = `computed${"\\"}(${"\\"}(${"\\"}): ${typeName
      .replace(/\|/g, "\\|")
      .replace(/\{/g, "\\{")
      .replace(/\[/g, "\\[")
      .replace(/]/g, "\\]")
      .replace(/}/g, "\\}")} `;

    const re = new RegExp(str, "gm");

    setupBlockHandled = setupBlockHandled.replace(
      re,
      `computed<${typeName}>(() `
    );
  });

  return { setupBlockHandled, importsHandled };
};

export default handleScriptSetup;
