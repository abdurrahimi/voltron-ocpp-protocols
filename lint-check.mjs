import { exec } from 'child_process';
import chalk from 'chalk';

// Function to run a command and return a promise
function runCommand(command) {
  return new Promise((resolve, reject) => {
    exec(command, (error, stdout, stderr) => {
      if (error) {
        reject({ stdout, stderr });
      } else {
        resolve(stdout);
      }
    });
  });
}

async function runLintCheck() {
  try {
    console.log(chalk.blue('Running ESLint...'));

    // Run ESLint
    await runCommand('npx eslint ./src');
    console.log(chalk.green('ESLint passed successfully!'));
  } catch ({ stdout, stderr }) {
    console.error(
      chalk.red('ESLint failed. Please fix the following issues:\n'),
    );
    console.error(chalk.red(stderr));
    console.info(
      chalk.yellow(
        'If you believe this is a mistake, you can run command npm run lint to automatically fix some issues:\n',
      ),
    );
    process.exit(1);
  }
}

// Execute the lint check
runLintCheck();
