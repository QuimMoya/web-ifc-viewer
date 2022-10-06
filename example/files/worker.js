
onmessage = async function (file) {
    const f = file.data[0];
    const webIfc = new this.WebIFC.IfcAPI();
    await webIfc.Init();
    webIfc.wasmModule.FS.mkdir("/work");
    webIfc.wasmModule.FS.mount(webIfc.wasmModule.WORKERFS, { files: [f] }, "/work");
    //webIfc.Serialize("/work/" + f.name);
    console.log("/work/" + f.name);
    webIfc.Serialize2("/work/" + f.name, storeFile);
};

let count = 0;

function storeFile(data, size) {
  count++;
  console.log(data);
  console.log(size);
  console.log("creating /tape_" + count + ".bin ... ");
}

self.importScripts("./web-ifc-api-browser.js");