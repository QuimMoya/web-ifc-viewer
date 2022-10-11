let count = 0;
let webIfc;

onmessage = async function (message) {
    webIfc = new this.WebIFC.IfcAPI();
    await webIfc.Init();
    webIfc.wasmModule.FS.mkdir("/work");
    webIfc.wasmModule.FS.mount(webIfc.wasmModule.WORKERFS, { files: message.data.files }, "/work");
    if (message.data.id === "Serialize") {
        //webIfc.Serialize("/work/" + f.name);
        console.log("/work/" + message.data.files[0].name);
        webIfc.Serialize2("/work/" + message.data.files[0].name, storeFile);
    }
    else {
        console.log("Abriendo serialización");
        const vec = new webIfc.wasmModule.stringVector();
        for (let i = 0; i < message.data.files.length; i++) {
            vec.push_back("/work/" + message.data.files[i].name);
        }
        webIfc.OpenSerialized(vec);
    }
};

function storeFile(data, size) {
    if (size === 0) {
        const decoder = new TextDecoder("utf-8");
        const content = webIfc.wasmModule.FS.readFile(data);
        const newData = decoder.decode(content);
        postMessage({ data: newData });
    }
    else {
        count++;
        const att = { encoding: "binary" };
        const content = webIfc.wasmModule.FS.readFile(data, att);
        postMessage({ data: content });
    }
}

self.importScripts("./web-ifc-api-browser.js");