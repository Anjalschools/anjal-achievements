/**
 * Allows local tsx scripts to import modules that use `import "server-only"`.
 * Used only via NODE_OPTIONS=--require for debug/verify CLI — not for Next runtime.
 */
"use strict";

const Module = require("node:module");
const origLoad = Module._load;
Module._load = function patchedLoad(request, parent, isMain) {
  if (request === "server-only") {
    return {};
  }
  return origLoad.apply(this, arguments);
};
