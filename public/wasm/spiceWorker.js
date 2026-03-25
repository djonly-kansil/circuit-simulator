let outputBuffer = [];
let errorBuffer = [];

self.Module = {
    noInitialRun: true,
    noExitRuntime: false,
    print: function(text) {
        outputBuffer.push(text);
    },
    printErr: function(text) {
        errorBuffer.push(text);
    },
    onRuntimeInitialized: function() {
        self.postMessage({ type: 'initialized' });
    }
};

self.importScripts('ngspice.js');

self.onmessage = function(e) {
    if (e.data.type === 'simulate') {
        const netlist = e.data.netlist;
        outputBuffer = [];
        errorBuffer = [];

        try {
            // Write the netlist to the virtual file system
            self.Module.FS.writeFile('/circuit.cir', netlist);

            // Run ngspice in batch mode
            self.Module.callMain(['-b', '/circuit.cir']);
            
            // Send the result back
            self.postMessage({ 
                type: 'result', 
                output: outputBuffer.join('\n'),
                error: errorBuffer.join('\n')
            });
        } catch (error) {
            // Emscripten throws an ExitStatus exception when main() finishes
            if (error.name === 'ExitStatus' || typeof error === 'number' || (error && error.status !== undefined)) {
                self.postMessage({ 
                    type: 'result', 
                    output: outputBuffer.join('\n'),
                    error: errorBuffer.join('\n')
                });
            } else {
                self.postMessage({ 
                    type: 'error', 
                    message: error.toString(),
                    output: outputBuffer.join('\n'),
                    error: errorBuffer.join('\n')
                });
            }
        }
    }
};
