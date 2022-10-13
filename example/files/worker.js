let count = 0;
let webIfc;

onmessage = async function (message) {
    webIfc = new this.WebIFC.IfcAPI();
    await webIfc.Init();
    webIfc.wasmModule.FS.mkdir("/work");
    webIfc.wasmModule.FS.mount(webIfc.wasmModule.WORKERFS, { files: message.data.files }, "/work");
    if (message.data.id === "Serialize") {
        console.log("/work/" + message.data.files[0].name);
        const fileOutput = message.data.files[0].name.substring(0, message.data.files[0].name.length - 4);
        console.log("Output name: ", fileOutput);
        webIfc.Serialize("/work/" + message.data.files[0].name, fileOutput, storeFile);
    }
    else {
        console.log("Abriendo serialización");
        const vec = new webIfc.wasmModule.stringVector();
        for (let i = 0; i < message.data.files.length; i++) {
            vec.push_back("/work/" + message.data.files[i].name);
        }
        const settings = {
            COORDINATE_TO_ORIGIN: false,
            USE_FAST_BOOLS: true
        }
        const modelID = webIfc.OpenSerialized(vec, settings);
    }
};

function storeFile(fileName, size) {
    count++;
    if (size === 0) {
        const decoder = new TextDecoder("utf-8");
        const readFile = webIfc.wasmModule.FS.readFile(fileName);
        const content = decoder.decode(readFile);
        const data = { content, fileName };
        postMessage({ data: data });
    }
    else {
        const att = { encoding: "binary" };
        const content = webIfc.wasmModule.FS.readFile(fileName, att);
        const data = { content, fileName };
        postMessage({ data: data });
    }
}

self.importScripts("./web-ifc-api-browser.js");