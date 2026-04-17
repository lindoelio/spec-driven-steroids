#!/usr/bin/env node
const { program } = require('commander');

program
  .name('wordcount')
  .description('Count words, lines, and characters from stdin')
  .version('1.0.0')
  .option('-w, --words', 'count words')
  .option('-l, --lines', 'count lines')
  .option('-c, --chars', 'count characters')
  .option('-a, --all', 'count all (default)')
  .parse();

const args = program.opts();
const input = require('fs').readFileSync('/dev/stdin', 'utf-8');

const counts = {
  words: input.split(/\s+/).filter(w => w.length > 0).length,
  lines: input.split('\n').length,
  chars: input.length
};

if (args.all) {
  console.log(`${counts.lines} ${counts.words} ${counts.chars}`);
} else {
  if (args.words) console.log(`Words: ${counts.words}`);
  if (args.lines) console.log(`Lines: ${counts.lines}`);
  if (args.chars) console.log(`Chars: ${counts.chars}`);
}
