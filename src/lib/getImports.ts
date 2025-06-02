const getImports = (outputText: string) => {
    return (outputText.match(/^import(.*)/gim)?.join("\n") || "")
        .replace(/import\s?{(.*)}\sfrom\s"vue-property-decorator";?/, "")
        .replace(/defineComponent,?/, "")
        .replace(/toRefs,?/, "")
        .replace(/}\sfrom\s"@vue\/composition-api"?/, ', defineEmits, defineProps } from "vue"');
};

export default getImports;
