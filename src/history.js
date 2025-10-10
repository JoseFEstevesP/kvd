import fs from 'fs';
import path from 'path';
import inquirer from 'inquirer';

const historyFilePath = path.join(process.cwd(), 'history.json');

export function loadHistory() {
  if (fs.existsSync(historyFilePath)) {
    try {
      const historyData = fs.readFileSync(historyFilePath, 'utf-8');
      return JSON.parse(historyData);
    } catch (error) {
      console.error("Error loading history:", error);
      return [];
    }
  }
  return [];
}

export function saveHistory(history) {
  fs.writeFileSync(historyFilePath, JSON.stringify(history, null, 2));
}

export function addPathToHistory(newPath, history) {
  const index = history.indexOf(newPath);
  if (index > -1) {
    history.splice(index, 1);
  }
  history.unshift(newPath);
  if (history.length > 10) {
    history.pop();
  }
  saveHistory(history);
}

export async function chooseHistoryPath(history) {
  const choices = [
    { name: 'Enter a new path', value: 'new' },
    new inquirer.Separator(),
    ...history.map(p => ({ name: p, value: p }))
  ];

  if (history.length === 0) {
    choices.splice(1, 2);
  }

  const { chosenPath } = await inquirer.prompt([
    {
      type: 'list',
      name: 'chosenPath',
      message: 'Choose a download path:',
      choices,
    },
  ]);

  return chosenPath;
}