// Require the core node modules.
// import { green, red } from "chalk";
import { createWriteStream, createReadStream } from "fs";
import { stringify, parse } from "JSONStream";

// Trick for getting __dirname in ES6 modules
import { fileURLToPath } from 'url';
import { dirname } from 'path';
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename).replace('/bin', '/lib');

// ----------------------------------------------------------------------------------- //
// ----------------------------------------------------------------------------------- //


// Imagine that we are performing some sort of data migration and we have to move data
// from one database to flat files; then transport those flat files elsewhere; then,
// import those flat files into a different database.
var records = [
  { id: 1, name: "Terminator" },
  { id: 2, name: "Predator" },
  { id: 3, name: "True Lies" },
  { id: 4, name: "Running Man" },
  { id: 5, name: "Twins" }
  // .... hundreds of thousands of records ....
];

// If the record-sets are HUGE, then we run the risk of running out of memory when
// serializing the data as JSON:
// --
// RangeError: Invalid string length (aka, out-of-memory error)
// --
// As such, we're going to STREAM the record-set to a data file using JSONStream. The
// .stringify() method creates a TRANSFORM (or THROUGH) stream to which we will write
// the individual records in the record-set.

var transformStream = stringify();
var outputStream = createWriteStream(__dirname + "/data.json");

// In this case, we're going to pipe the serialized objects to a data file.
transformStream.pipe(outputStream);

// Iterate over the records and write EACH ONE to the TRANSFORM stream individually.
// --
// NOTE: If we had tried to write the entire record-set in one operation, the output
// would be malformed - it expects to be given items, not collections.
records.forEach(transformStream.write);

// Once we've written each record in the record-set, we have to end the stream so that
// the TRANSFORM stream knows to output the end of the array it is generating.
transformStream.end();

// Once the JSONStream has flushed all data to the output stream, let's indicate done.
outputStream.on(
  "finish",
  function handleFinish() {

    console.log("JSONStream serialization complete!");
    console.log("- - - - - - - - - - - - - - - - - - - - - - -");

  }
);


// ----------------------------------------------------------------------------------- //
// ----------------------------------------------------------------------------------- //


// Since the stream actions are event-driven (and asynchronous), we have to wait until
// our output stream has been closed before we can try reading it back in.
outputStream.on(
  "finish",
  function handleFinish() {

    // When we read in the Array, we want to emit a "data" event for every item in
    // the serialized record-set. As such, we are going to use the path "*".
    var transformStream = parse("*");
    var inputStream = createReadStream(__dirname + "/data.json");

    // Once we pipe the input stream into the TRANSFORM stream, the parser will
    // start working it's magic. We can bind to the "data" event to handle each
    // top-level item as it is parsed.
    inputStream
      .pipe(transformStream)

      // Each "data" event will emit one item in our record-set.
      .on(
        "data",
        function handleRecord(data) {

          console.log("Record (event):", data);

        }
      )

      // Once the JSONStream has parsed all the input, let's indicate done.
      .on(
        "end",
        function handleEnd() {

          console.log("- - - - - - - - - - - - - - - - - - - - - - -");
          console.log("JSONStream parsing complete!");

        }
      )
      ;

  }
);
