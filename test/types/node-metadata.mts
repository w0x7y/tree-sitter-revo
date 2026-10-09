import binding from "../../bindings/node/index.js";

const leaf: typeof binding.nodeTypeInfo[number] = { type: "+", named: false };
for (const info of binding.nodeTypeInfo) {
  if ("children" in info && info.children) {
    const names: string[] = info.children.types.map(child => child.type);
    void names;
  }
  if ("fields" in info) {
    const namedTypes: string[] | undefined = info.fields.name?.types.map(type => type.type);
    void namedTypes;
  }
  if ("subtypes" in info) {
    const names: string[] = info.subtypes.map(type => type.type);
    void names;
  }
}
void leaf;
