"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const streams = require("stream");
const fs = require("fs");
let rowRecordRegExp = /^>([^\n]+)\n([^>]+)/;
class fasta extends streams.Duplex {
    constructor() {
        super();
        this.record = [];
        this.buffer = undefined;
        this.outputTag = "inputMFasta";
    }
    _write(chunk, enc, next) {
        this.buffer = this.buffer ? Buffer.concat([this.buffer, chunk]) : chunk;
        next();
        this.on('finish', () => {
            if (this.buffer)
                this.readFasta(this.buffer.toString());
            //console.log("TOTAL Buffer is " + this.buffer.toString());
        });
    }
    _read() {
        let start = this.sliceStart ? this.sliceStart : 0;
        let stop = this.sliceOffset ? start + this.sliceOffset < this.record.length ? start + this.sliceOffset : this.record.length - 1 : start + this.record.length - 1;
        let dBuf = this.record.filter((e, i) => { return i <= stop && e.seq && e.header; }).map((rec) => { return `${rec.header}\n${rec.seq}`; });
        this.push(JSON.stringify({ [this.outputTag]: dBuf }));
        this.push(null);
    }
    setSlice(start = 0, offset) {
        this.sliceStart = start;
        this.sliceOffset = offset;
        return this;
    }
    // Returns as readable stream
    streamJsonFasta(prefix = "inputMFasta", start, offset) {
        start = start ? start : 0;
        let stop = offset ? start + offset < this.record.length ? start + offset : this.record.length - 1 : start + this.record.length - 1;
        let dBuf = this.record.filter((e, i) => { return i <= stop && e.seq && e.header; }).map((rec) => { return rec.header + rec.seq; });
        let streamOut = new streams.Readable();
        streamOut.push(JSON.stringify({ [this.outputTag]: dBuf }));
        streamOut.push(null);
        return (streamOut);
    }
    readFasta(data) {
        if (!data.startsWith('>'))
            this.emit('readError', 'fileFormatError'); //this.emit('error', 'Fasta format error');
        let buffer = data.split(/(>[^>]+)/).filter((c) => { return c != ''; });
        this.record = buffer.map((e) => {
            console.log(e);
            let match = rowRecordRegExp.exec(e);
            if (!match) {
                // this.emit('error', 'Fasta format error');
                this.emit('readError', `lineFormatError at : ${e}`);
                return {
                    'header': '',
                    'seq': ''
                };
            }
            return {
                'header': match[1],
                'seq': match[2]
            };
        });
        this.emit('parsed');
    }
    // Making it iterable
    //https://basarat.gitbooks.io/typescript/docs/iterators.html
    //https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide/Iterators_and_Generators
    //https://www.nextptr.com/question/a62310881/creating-custom-iterable-by-implementing-symboliterator-method
    *[Symbol.iterator]() {
        for (let rec of this.record) {
            yield (rec);
        }
    }
}
function parser(source) {
    return new Promise((resolve, reject) => {
        let inputStream = new streams.Readable();
        let fastaObj = new fasta();
        if (typeof source === 'string')
            fs.stat(source, function (err, stat) {
                if (!err) {
                    console.log('File exists');
                    inputStream = fs.createReadStream(source);
                }
                else {
                    inputStream.push(source);
                    inputStream.push(null);
                }
                inputStream.pipe(fastaObj);
                fastaObj.on('parsed', () => { resolve(fastaObj); })
                    .on('readError', (msg) => { reject(`readError (${msg})`); });
            });
    });
}
exports.parser = parser;
