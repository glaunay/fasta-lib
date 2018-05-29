"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const fastaLib = require("../index");
/*
This test script parses a multiFasta
*/
let file = process.argv[2];
fastaLib.parser(file).then((fastaObj) => {
    for (let fastaRecord of fastaObj) {
        console.log(fastaRecord.header);
    }
    fastaObj.pipe(process.stdout);
    fastaObj.setSlice(1, 1).pipe(process.stdout);
    fastaObj.setSlice(0, 2).setTag('customTag').pipe(process.stdout);
}).catch((e) => {
    console.log("Parsing error");
    console.log(e);
});
