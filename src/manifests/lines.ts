export function findNameLine(content: string, name: string): number | undefined {
  const lines = content.split(/\r?\n/);

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index] ?? '';
    const at = line.indexOf(name);
    if (at === -1) continue;

    const before = at === 0 ? '' : line[at - 1] ?? '';
    const after = line[at + name.length] ?? '';
    const startsClean = before === '' || !/[A-Za-z0-9._-]/.test(before);
    const endsClean = after === '' || !/[A-Za-z0-9._-]/.test(after);

    if (startsClean && endsClean) return index + 1;
  }

  return undefined;
}
