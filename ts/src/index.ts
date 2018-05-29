import streams = require('stream');
import events = require('events');
import fs = require('fs'); 

let rowRecordRegExp = /^>([^\n]+)\n([^>]+)/;


/*
    Duplex implemntation of a multi fasta container
    No amino-acid type checking
*/


interface fastaRecord {
    seq : string,
    header : string
}

class fasta extends streams.Duplex { // streams inherits EventEmiter
    private record:fastaRecord[] = [];
    private buffer:Buffer|undefined = undefined;
    
    outputTag:string="inputMFasta";
    sliceStart?:number;
    sliceOffset?:number;
    
    constructor() {
        super();
   }
   _copy():fasta {
       let clone:fasta = new fasta();
       clone.sliceStart = this.sliceStart;
       clone.sliceOffset = this.sliceOffset;
       clone.record = this.record;
       clone.outputTag = this.outputTag;
       return clone;
   }
   _write (chunk:Buffer, enc:string, next:any) {       
        this.buffer =  this.buffer ? Buffer.concat([this.buffer, chunk]) : chunk;
        next();
        this.on('finish',()=>{
            if(this.buffer)
                this.readFasta(this.buffer.toString());
                //console.log("TOTAL Buffer is " + this.buffer.toString());
        });
    }
    _read() {
        let start:number = this.sliceStart ? this.sliceStart : 0;
        let stop:number = this.sliceOffset ? start + this.sliceOffset < this.record.length ? start + this.sliceOffset :  this.record.length - 1 : start + this.record.length - 1;
        let dBuf:string[] = this.record.filter((e,i)=>{ return i <= stop && i >= start && e.seq && e.header;}).map((rec)=>{return `${rec.header}\n${rec.seq}`;});

        this.push(JSON.stringify({[this.outputTag] : dBuf}));
        this.push(null);
    }
    setSlice(start:number=0, offset?:number):fasta {
        let clone = this._copy();
        clone.sliceStart = start;
        clone.sliceOffset = offset;
        return clone;
    }
    setTag(cTag:string):fasta {
        let clone = this._copy();
        clone.outputTag = cTag;
        return clone;
    }
    // Returns as readable stream
    streamJsonFasta(prefix:string="inputMFasta", start?:number, offset?:number):streams.Readable {
        start = start ? start : 0;
        let stop:number = offset ? start + offset < this.record.length ? start + offset :  this.record.length - 1 : start + this.record.length - 1;
        let dBuf:string[] = this.record.filter((e,i)=>{ return i <= stop && e.seq && e.header;}).map((rec)=>{return rec.header + rec.seq;});

        let streamOut = new streams.Readable();
        streamOut.push(JSON.stringify({[this.outputTag] : dBuf}));
        streamOut.push(null);
        return(streamOut);
    }
    
    readFasta(data:string){
        if( !data.startsWith('>') )
            this.emit('readError','fileFormatError');//this.emit('error', 'Fasta format error');
        
        let buffer:string[] = data.split(/(>[^>]+)/).filter((c:string)=>{return c != ''; })
        this.record = buffer.map((e:string)=>{
            console.log(e);
            let match = rowRecordRegExp.exec(e);
            if (!match) {
               // this.emit('error', 'Fasta format error');
                this.emit('readError', `lineFormatError at : ${e}`);
                return { // This should never happen as 'readError' will be catched as error
                    'header': '',
                    'seq': ''
                };
            }
            return {
                'header': match[1],
                'seq': match[2]
            }
        });
        this.emit('parsed');
   }
   // Making it iterable
   //https://basarat.gitbooks.io/typescript/docs/iterators.html
   //https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide/Iterators_and_Generators
   //https://www.nextptr.com/question/a62310881/creating-custom-iterable-by-implementing-symboliterator-method
   *[Symbol.iterator]():IterableIterator<fastaRecord>{
       for (let rec of this.record) {
            yield(rec);
        }
    }
}




export function parser(source:string|streams.Readable):Promise<fasta> {
    return new Promise( (resolve, reject) => {
        let inputStream = new streams.Readable();
        let fastaObj = new fasta();
        if (typeof source === 'string')
        fs.stat(source, function(err:any, stat:any) {
            if(!err) {
                console.log('File exists');
                inputStream = fs.createReadStream(source);
            }  else {
                inputStream.push(source);
                inputStream.push(null);
            }
            inputStream.pipe(fastaObj);
            fastaObj.on('parsed',()=> {resolve(fastaObj)})
                    .on('readError',(msg)=>{reject(`readError (${msg})`);});
        });
    });
}