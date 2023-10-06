import { Command} from 'commander';
const program = new Command();

program.name('splay')
  .usage('[options] <file ...>')
  .description('Build Files from linked data')
  .option('--source <source ...>', 'Specify linked data source. Can be specified multiple times')
  .option('--construct <construct>', 'Construct SPARQL query')
  .option('--select <select>', 'Select SPARQL query')

program.parse(process.argv);

const options = program.opts();
console.log(options);

if (program.args.length > 0) {
  const parser = new JsonLdParser();
  const backend = new MemoryLevel();
  const df= new DataFactory();
  const qstore = new QuadStore(backend, dataFactory: df);
  const engine= new QueryEngine();

  await qstore.open();

  for (const i in program.args) {
    console.log(`File: ${program.args[i]}`);
    fs.readFileSync(program.args[i], 'utf8', (err, data) => {
      if (err) {
        console.error(err);
        return;
      }
      console.log(data);
    });

  }
}

https://gist.github.com/rakunkel-ucd/9da734bd6b0737ad49586793c711d2a8?permalink_comment_id=4494936#gistcomment-4494936

qstore.import(myParser.import(Readable.from(ldJson)))
.on('data', data=> console.log("Q"))
.on('end', ()=> qstore_save())

async function qstore_save() {
const items = await qstore.get({});
fs.writeFileSync('quadstore_stream.json', JSON.stringify(items), 'utf8');
}

https://nodejs.org/api/fs.html
