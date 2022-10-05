
onmessage = async function (file) {
    const f = file.data[0];
    const webIfc = new this.WebIFC.IfcAPI();
    await webIfc.Init();
    webIfc.wasmModule.FS.mkdir("/work");
    webIfc.wasmModule.FS.mount(webIfc.wasmModule.WORKERFS, { files: [f] }, "/work");
    webIfc.Serialize("/work/" + f.name);
};

self.importScripts("./web-ifc-api-browser.js");