const addImport = (imports: string, path: string, importName: string) => {
  const clearImportName = importName.replace("{", "").replace("}", "");

  if (imports.includes(path)) {
    if (imports.includes(clearImportName)) return imports;

    const re = `import {(.*)} from "${path}"`;
    const currentImports = imports.match(new RegExp(re))?.[1]?.trim();

    if (!currentImports) return imports;

    if (importName.match(/\{(.*)}/)) {
      return imports.replace(
        currentImports,
        `${currentImports}, ${clearImportName}`
      );
    } else {
      return imports.insert(imports.indexOf(currentImports) - 3, importName);
    }
  }

  return `${imports}\nimport ${importName} from "${path}";`;
};

export default addImport;
