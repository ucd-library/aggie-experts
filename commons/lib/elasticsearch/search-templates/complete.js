import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// Trick for getting __dirname in ES6 modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const source = fs.readFileSync(path.resolve(__dirname, './complete.mustache'), 'utf8');

const template = {
  id: "complete",
  script: {
    "lang": "mustache",
    "source": source,
    "params": {
      "q": "My query string",
      "min_nested_score": 10.0,
      "min_score": 10.0
    }
  }
};

export default template;
