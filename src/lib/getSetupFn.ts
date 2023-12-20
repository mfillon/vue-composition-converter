const getSetupFn = (outputText: string) => {
  const setupFn: string | RegExpMatchArray | null = outputText.match(
    /(?<=setup\(_?props,\sctx\)\s{\s)([\s\S]+?)(?=$)/gi
  );

  if (!setupFn?.length) return;

  const lastReturn = setupFn[0]
    .match(/(?<=return\s{\s)([\s\S]+?)(?=})/gi)
    ?.at(-1);

  if (!lastReturn) return;

  const lastImport = outputText.match(/^import(.*)/gim)?.at(-1);
  const middle = !lastImport
    ? ""
    : outputText.slice(
        outputText.indexOf(lastImport) + lastImport.length,
        outputText.indexOf("export default")
      );

  return middle + "\n" + setupFn[0].replace(`${lastReturn}}`, "").slice(0, -18);
};

export default getSetupFn;
