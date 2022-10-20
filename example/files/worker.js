let count = 0;
let webIfc;

onmessage = async function (message) {
    webIfc = new this.WebIFC.IfcAPI();
    await webIfc.Init();
    webIfc.wasmModule.FS.mkdir("/work");
    webIfc.wasmModule.FS.mount(webIfc.wasmModule.WORKERFS, { files: message.data.files }, "/work");
    if (message.data.id === "Serialize") {
        const vec = new webIfc.wasmModule.stringVector();
        for (let i = 0; i < message.data.files.length; i++) {
            vec.push_back("/work/" + message.data.files[i].name);
            console.log("/work/" + message.data.files[i].name);
        }
        const fileOutput = message.data.files[0].name.substring(0, message.data.files[0].name.length - 4);
        console.log("Output name: ", fileOutput);
        webIfc.Serialize(vec, fileOutput, storeFile, 700000000);
        //this.postMessage({id: "finish" });
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
        const modelID = webIfc.OpenSerialized(vec, settings, 700000000);
    }
    webIfc = null;
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
    webIfc.wasmModule.FS.truncate(fileName, 1);
    webIfc.wasmModule.FS.unlink(fileName);
}

self.importScripts("./web-ifc-api-browser.js");