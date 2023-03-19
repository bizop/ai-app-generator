import { Configuration, OpenAIApi } from 'openai';
import fs from 'fs';

const configuration = new Configuration({
  apiKey: 'YOUR_OPENAI_API_KEY',
});
export const openai = new OpenAIApi(configuration);

String.prototype.toArray = function () {
  let rows = this.split('\n');
  let array = [];
  for (let i = 0; i < rows.length; i++) {
    let item = rows[i];
    array.push(item);
  }
  return array;
};

function getParentFolderId(structureMap, folderName) {
  for (let [key, value] of structureMap.entries()) {
    if (value.name === folderName) return key;
  }
}

function createFoldersFiles(structureMap, data, codeForFile) {
  if (data.type === 'folder') {
    let dir = '';
    if (data.level === 0) {
      dir = `./`;
    } else if (data.level === 2) {
      dir = `./${data.parentFolder}`;
    } else if (data.level === 4) {
      let parentId = getParentFolderId(structureMap, data.parentFolder);
      let parentsParent = structureMap.get(parentId);
      dir = `./${parentsParent.name}/${data.parentFolder}`;
    }

    let dirName = data.name.replace('/', '');
    dir = dir += `/${dirName}`;

    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  } else if (data.type === 'file') {
    let dir = '';
    if (data.level === 0) {
      dir = `./${data.name}`;
    } else if (data.level === 2) {
      dir = `./${data.parentFolder}/${data.name}`;
    } else if (data.level === 4) {
      let parentId = getParentFolderId(structureMap, data.parentFolder);
      let parentsParent = structureMap.get(parentId);
      dir = `./${parentsParent.parentFolder}/${data.parentFolder}/${data.name}`;
    }

    fs.writeFile(dir, codeForFile, function (err) {
      if (err) {
        console.log(err);
      }
    });
  }
}

async function createCode(type, functionality, structure, file, allCode) {
  console.log(`Creating file: ${file}...`);
  const prompt = {
    model: 'text-davinci-003',
    prompt: `[APP TYPE]: ${type}
[APP FUNCTIONALITY]: ${functionality}
[FOLDER / FILE STRUCTURE]:
${structure}
[PREVIOUS CODE]:
${allCode}
[INSTRUCTIONS]: Taking into account the above file structure and information, create the ${file} file needed for a ${type}.
[CODED FILE]:`,
    temperature: 0.7,
    max_tokens: 2000,
    top_p: 1,
    frequency_penalty: 0,
    presence_penalty: 0,
    stop: '[STOP]',
  };
  const res = await openai.createCompletion(prompt);
  const data = res.data.choices[0].text;
  console.log(`File created: ${file}`);
  return data;
}

async function createStructure(type, functionality, languages) {
  const prompt = {
    model: 'text-davinci-003',
    prompt: `[INSTRUCTIONS]: Generate the folder and file structure needed for a simple application using the following information.
[TYPE OF APP]: notepad app
[FUNCTIONALITY]: add notepad items, delete items, edit items, saves to local storage
[LANGUAGES / LIBRARIES]: HTML, CSS, JS
[FOLDER / FILE STRUCTURE]:
/notepadapp
  /js
    app.js
  /css
    style.css
  index.html
[STOP]
[INSTRUCTIONS]: Generate the folder and file structure needed for a simple application using the following information.
[TYPE OF APP]: ${type}
[FUNCTIONALITY]: ${functionality}
[LANGUAGES / LIBRARIES]: ${languages}
[FOLDER / FILE STRUCTURE]:
`,
    temperature: 0.7,
    max_tokens: 500,
    top_p: 1,
    frequency_penalty: 0,
    presence_penalty: 0,
    stop: '[STOP]',
  };
  const res = await openai.createCompletion(prompt);
  const data = res.data.choices[0].text.trim();
  // console.log(data);
  return data;
}

async function createApplication(type, functionality, languages) {
  let structure = await createStructure(type, functionality, languages);
  console.log(structure);
  let lines = structure.toArray();

  let structureMap = new Map([]);
  let allCode = '';

  for (let i = 0; i < lines.length; i++) {
    let line = lines[i];
    let trimLine = line.trim();
    // DETECT LEVEL BY SPACES
    let numSpaces = 0;
    for (let j = 0; j < line.length; j++) {
      if (line[j] === ' ') {
        numSpaces++;
      }
    }
    // DETECT PARENT FOLDER
    let parentFolderId = '';
    for (let k = lines.length; k > 0; k--) {
      let parentTarget = structureMap.get(i - k);
      if (parentTarget && parentTarget.type === 'folder' && parentTarget.level < numSpaces) {
        parentFolderId = parentTarget.name;
      }
    }
    // DETECT IF FOLDER
    if (trimLine[0] === '/') {
      structureMap.set(i, { id: i, type: 'folder', level: numSpaces, parentFolder: parentFolderId, name: line.trim() });
      createFoldersFiles(structureMap, structureMap.get(i));
    }
    // DETECT IF FILE
    let isFile = line.match(/\.(html|css|js|json)$/gi);
    if (isFile) {
      structureMap.set(i, { id: i, type: 'file', level: numSpaces, parentFolder: parentFolderId, name: line.trim() });
      let codeForFile = await createCode(type, functionality, structure, line.trim(), allCode);
      allCode += codeForFile;
      createFoldersFiles(structureMap, structureMap.get(i), codeForFile.trim());
    }
  }
  // createCode(structure, file);

  structureMap.forEach((value) => {
    console.log(value);
  });

  return structureMap;
}

// INPUTS
// - TYPE OF PROJECT (e.g. "To-do app, WordPress plugin, Chrome extention, etx")
// - DESIRED FUNCTIONALITY (e.g. "Add items, delete items, edit items, save in local storage, etc")
// - LANGUAGES (e.g. "HTML, CSS, Javascript, Python, Ruby, etc")

createApplication('todo list app', 'save todo items to local storage, delete todo items from local storage', 'HTML, CSS, JS');
