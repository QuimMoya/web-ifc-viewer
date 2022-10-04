
onmessage = async function (file) {
    const f = file.data[0];
    console.log(f);
    const webIfc = new this.WebIFC.IfcAPI();
    await webIfc.Init();
    console.log(webIfc);

    webIfc.wasmModule.FS.mkdir("/work");
    webIfc.wasmModule.FS.mount(webIfc.wasmModule.WORKERFS, { files: [f] }, "/work");

    const modelID = webIfc.CreateModel();
    webIfc.Serialize("/work/" + f.name, modelID);
};

self.importScripts("./web-ifc-api-browser.js");